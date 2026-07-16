import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Content } from '../../entities/content.entity';
import { CreateContentDto } from './dto';

/** Quá ngưỡng report thì tự ẩn chờ admin duyệt */
const AUTO_HIDE_REPORT_THRESHOLD = 3;

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(Content)
    private readonly repo: Repository<Content>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** Post user tạo (chưa xác thực — check-in mới tạo verification) */
  create(userId: string, dto: CreateContentDto) {
    const c = this.repo.create({
      restaurantId: dto.restaurantId,
      userId,
      mediaType: dto.mediaType,
      caption: dto.caption ?? null,
      origin: 'user_generated',
      occasions: dto.occasions ?? [],
    });
    return this.repo.save(c);
  }

  /**
   * Nội dung của 1 quán, kèm cờ isVerified.
   * Post đã xác thực xếp trước; post tổng hợp luôn kèm nguồn + credit
   * để client hiển thị khác biệt rõ (yêu cầu bắt buộc trong định hướng).
   */
  listByRestaurant(restaurantId: string) {
    return this.dataSource.query(
      `SELECT c.id, c.restaurant_id AS "restaurantId", c.user_id AS "userId",
              u.display_name AS "userDisplayName",
              c.media_type AS "mediaType", c.caption, c.origin,
              c.source_platform AS "sourcePlatform", c.source_url AS "sourceUrl",
              c.source_author AS "sourceAuthor", c.occasions,
              c.photo_urls AS "photoUrls",
              c.created_at AS "createdAt",
              EXISTS (
                SELECT 1 FROM verifications v
                WHERE v.content_id = c.id AND v.result = 'passed'
              ) AS "isVerified"
       FROM contents c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.restaurant_id = $1 AND c.is_hidden = false
       ORDER BY "isVerified" DESC, c.created_at DESC
       LIMIT 100`,
      [restaurantId],
    );
  }

  async report(contentId: string) {
    const content = await this.repo.findOneBy({ id: contentId });
    if (!content) throw new NotFoundException('Không tìm thấy nội dung');
    content.reportCount += 1;
    if (content.reportCount >= AUTO_HIDE_REPORT_THRESHOLD) {
      content.isHidden = true;
    }
    await this.repo.save(content);
    return { reportCount: content.reportCount, isHidden: content.isHidden };
  }

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }
}
