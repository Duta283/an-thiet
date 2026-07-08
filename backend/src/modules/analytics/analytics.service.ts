import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppEvent } from '../../entities/event.entity';

export interface TrackOptions {
  userId?: string | null;
  anonId?: string | null;
  properties?: Record<string, unknown>;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AppEvent)
    private readonly events: Repository<AppEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Fire-and-forget: tracking KHÔNG BAO GIỜ được làm chậm hoặc làm hỏng
   * request chính — lỗi chỉ log warning.
   */
  track(name: string, opts: TrackOptions = {}): void {
    void this.events
      .save(
        this.events.create({
          name,
          userId: opts.userId ?? null,
          anonId: opts.anonId ?? null,
          properties: opts.properties ?? null,
        }),
      )
      .catch((e) => this.logger.warn(`track(${name}) lỗi: ${e}`));
  }

  /** Nạp batch event từ client (đã validate tên qua DTO) */
  async ingest(
    events: { name: string; properties?: Record<string, unknown> }[],
    ids: { userId?: string | null; anonId?: string | null },
  ): Promise<{ accepted: number }> {
    if (events.length === 0) return { accepted: 0 };
    await this.events.save(
      events.slice(0, 100).map((e) =>
        this.events.create({
          name: e.name,
          properties: e.properties ?? null,
          userId: ids.userId ?? null,
          anonId: ids.anonId ?? null,
        }),
      ),
    );
    return { accepted: Math.min(events.length, 100) };
  }

  /**
   * Chỉ số pilot theo mục 8 concept gốc. Retention D7 là bản xấp xỉ v0:
   * user có session 7-14 ngày trước VÀ có session trong 7 ngày qua.
   * Khảo sát tin cậy (survey) làm ngoài app — không nằm ở đây.
   */
  async metrics() {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT count(DISTINCT coalesce(user_id::text, anon_id)) FROM events
          WHERE name = 'app_session_start' AND created_at >= now() - interval '1 day')::int
          AS dau,
        (SELECT count(DISTINCT coalesce(user_id::text, anon_id)) FROM events
          WHERE name = 'app_session_start' AND created_at >= now() - interval '7 days')::int
          AS wau,
        (SELECT count(*) FROM events
          WHERE name = 'search' AND created_at >= now() - interval '7 days')::int
          AS searches_7d,
        (SELECT count(*) FROM events
          WHERE name = 'checkin_completed' AND created_at >= now() - interval '7 days')::int
          AS checkins_7d,
        (SELECT count(*) FROM events
          WHERE name = 'checkin_completed'
            AND (properties->>'isVerified')::boolean
            AND created_at >= now() - interval '7 days')::int
          AS verified_checkins_7d,
        (SELECT count(*) FROM events
          WHERE name = 'follow' AND created_at >= now() - interval '7 days')::int
          AS follows_7d,
        (SELECT count(*) FROM contents WHERE is_hidden = false)::int AS content_total,
        (SELECT count(*) FROM contents c
          WHERE c.is_hidden = false AND EXISTS (
            SELECT 1 FROM verifications v
            WHERE v.content_id = c.id AND v.result = 'passed'))::int
          AS content_verified,
        (SELECT coalesce(round(avg(cnt), 2), 0) FROM (
          SELECT count(*) AS cnt FROM follows GROUP BY follower_id
        ) t)::float AS avg_follows_per_follower,
        (SELECT count(DISTINCT e1.user_id) FROM events e1
          WHERE e1.name = 'app_session_start' AND e1.user_id IS NOT NULL
            AND e1.created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days')::int
          AS d7_cohort,
        (SELECT count(DISTINCT e1.user_id) FROM events e1
          WHERE e1.name = 'app_session_start' AND e1.user_id IS NOT NULL
            AND e1.created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'
            AND EXISTS (
              SELECT 1 FROM events e2
              WHERE e2.user_id = e1.user_id AND e2.name = 'app_session_start'
                AND e2.created_at >= now() - interval '7 days'))::int
          AS d7_retained
    `);
    return {
      dau: row.dau,
      wau: row.wau,
      searches7d: row.searches_7d,
      checkins7d: row.checkins_7d,
      verifiedCheckins7d: row.verified_checkins_7d,
      follows7d: row.follows_7d,
      contentVerifiedPct:
        row.content_total > 0
          ? Math.round((row.content_verified / row.content_total) * 1000) / 10
          : 0,
      avgFollowsPerFollower: row.avg_follows_per_follower,
      d7RetentionApprox:
        row.d7_cohort > 0
          ? Math.round((row.d7_retained / row.d7_cohort) * 1000) / 10
          : null,
      d7Cohort: row.d7_cohort,
    };
  }
}
