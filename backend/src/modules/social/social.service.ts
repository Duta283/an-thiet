import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Follow } from '../../entities/follow.entity';
import { SavedItem } from '../../entities/saved-item.entity';
import { User } from '../../entities/user.entity';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Follow)
    private readonly follows: Repository<Follow>,
    @InjectRepository(SavedItem)
    private readonly saved: Repository<SavedItem>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly analytics: AnalyticsService,
  ) {}

  async follow(followerId: string, followedId: string) {
    if (followerId === followedId) {
      throw new BadRequestException('Không thể tự follow chính mình');
    }
    const target = await this.users.findOneBy({ id: followedId });
    if (!target) throw new NotFoundException('Không tìm thấy user');
    await this.follows.save(this.follows.create({ followerId, followedId }));
    this.analytics.track('follow', {
      userId: followerId,
      properties: { followedId },
    });
    return { ok: true };
  }

  async unfollow(followerId: string, followedId: string) {
    await this.follows.delete({ followerId, followedId });
    return { ok: true };
  }

  /** Profile công khai: trust score + follower/following + số nội dung verified */
  async profile(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Không tìm thấy user');
    const [stats] = await this.dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM follows WHERE followed_id = $1) AS "followerCount",
         (SELECT count(*)::int FROM follows WHERE follower_id = $1) AS "followingCount",
         (SELECT count(*)::int FROM contents c
           WHERE c.user_id = $1 AND EXISTS (
             SELECT 1 FROM verifications v
             WHERE v.content_id = c.id AND v.result = 'passed'
           )) AS "verifiedContentCount"`,
      [userId],
    );
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      trustScore: user.trustScore,
      createdAt: user.createdAt,
      ...stats,
    };
  }

  async saveRestaurant(userId: string, restaurantId: string, listName?: string) {
    return this.saved.save(
      this.saved.create({
        userId,
        restaurantId,
        listName: listName ?? 'Để dành',
      }),
    );
  }

  /** "Quán để dành" của user, gom theo list */
  listSaved(userId: string) {
    return this.dataSource.query(
      `SELECT s.id, s.list_name AS "listName", s.created_at AS "createdAt",
              r.id AS "restaurantId", r.name, r.area,
              r.thumbnail_url AS "thumbnailUrl",
              r.cuisine_types AS "cuisineTypes", r.lat, r.lng
       FROM saved_items s
       JOIN restaurants r ON r.id = s.restaurant_id
       WHERE s.user_id = $1
       ORDER BY s.list_name, s.created_at DESC`,
      [userId],
    );
  }

  async removeSaved(userId: string, savedId: string) {
    await this.saved.delete({ id: savedId, userId });
    return { ok: true };
  }
}
