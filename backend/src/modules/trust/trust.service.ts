import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

/**
 * Trust Score v0 — công thức khởi điểm mục 4.2, diễn giải được (không black-box):
 *
 *   trust_score = 0.4 × (tỷ lệ nội dung đã verified / tổng nội dung đã đăng)
 *               + 0.3 × log(số follower đáng tin cậy + 1)   [chuẩn hoá]
 *               + 0.2 × (tuổi tài khoản, giới hạn trần)
 *               + 0.1 × (1 − tỷ lệ nội dung bị report/ẩn)
 *
 * - Follower đáng tin cậy = follower có trust_score ≥ TRUSTED_THRESHOLD.
 *   Chỉ 1 vòng lặp (không tính follower của follower) — đúng scope MVP.
 * - CHỈ dùng để xếp hạng hiển thị trong kết quả tìm kiếm.
 *   KHÔNG dùng để tính điểm sao — concept không có điểm sao.
 * - Nâng cấp sang mô hình đồ thị đầy đủ ở giai đoạn Mở rộng (tháng 9+).
 */
const W_VERIFIED = 0.4;
const W_FOLLOWERS = 0.3;
const W_AGE = 0.2;
const W_REPORT = 0.1;
/** Ngưỡng follower "đáng tin cậy" */
export const TRUSTED_THRESHOLD = 0.5;
/** Chuẩn hoá log follower: đạt trần tại ~100 follower đáng tin cậy */
const FOLLOWER_CAP = 100;
/** Trần tuổi tài khoản: 365 ngày */
const AGE_CAP_DAYS = 365;

export interface TrustBreakdown {
  userId: string;
  trustScore: number;
  components: {
    verifiedRatio: number;
    trustedFollowers: number;
    accountAgeDays: number;
    reportedRatio: number;
  };
}

@Injectable()
export class TrustService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async computeForUser(userId: string): Promise<TrustBreakdown> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Không tìm thấy user');

    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM contents c
           WHERE c.user_id = $1 AND c.origin = 'user_generated') AS total,
         (SELECT count(*)::int FROM contents c
           WHERE c.user_id = $1 AND c.origin = 'user_generated'
             AND EXISTS (SELECT 1 FROM verifications v
                         WHERE v.content_id = c.id AND v.result = 'passed')
         ) AS verified,
         (SELECT count(*)::int FROM contents c
           WHERE c.user_id = $1 AND (c.is_hidden OR c.report_count > 0)) AS reported,
         (SELECT count(*)::int FROM follows f
           JOIN users fu ON fu.id = f.follower_id
           WHERE f.followed_id = $1 AND fu.trust_score >= $2) AS trusted_followers`,
      [userId, TRUSTED_THRESHOLD],
    );

    const total: number = row.total;
    const verifiedRatio = total > 0 ? row.verified / total : 0;
    const reportedRatio = total > 0 ? Math.min(1, row.reported / total) : 0;
    const followerComponent = Math.min(
      1,
      Math.log(row.trusted_followers + 1) / Math.log(FOLLOWER_CAP + 1),
    );
    const ageDays =
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000;
    const ageComponent = Math.min(1, ageDays / AGE_CAP_DAYS);

    const score =
      W_VERIFIED * verifiedRatio +
      W_FOLLOWERS * followerComponent +
      W_AGE * ageComponent +
      W_REPORT * (1 - reportedRatio);

    const trustScore = Math.round(score * 1000) / 1000;
    await this.users.update(userId, { trustScore });

    return {
      userId,
      trustScore,
      components: {
        verifiedRatio: Math.round(verifiedRatio * 1000) / 1000,
        trustedFollowers: row.trusted_followers,
        accountAgeDays: Math.round(ageDays),
        reportedRatio: Math.round(reportedRatio * 1000) / 1000,
      },
    };
  }

  /** Recompute toàn bộ — gọi định kỳ (cron ngoài) hoặc thủ công qua admin API */
  async recomputeAll(): Promise<{ updated: number }> {
    const ids: { id: string }[] = await this.dataSource.query(
      'SELECT id FROM users',
    );
    for (const { id } of ids) {
      await this.computeForUser(id);
    }
    return { updated: ids.length };
  }
}
