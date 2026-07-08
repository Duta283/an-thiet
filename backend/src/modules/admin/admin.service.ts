import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content } from '../../entities/content.entity';
import { User } from '../../entities/user.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { SearchService } from '../search/search.service';
import { SeedPayloadDto } from './dto';

/**
 * Seed tool (mục 5, 6): "công cụ nội bộ quan trọng nhất" giai đoạn 0-3 tháng.
 * Mục tiêu: 1-2 người vận hành nạp đủ dày nội dung Quận 7 trong vài tuần.
 * Idempotent theo tên quán — chạy lại cùng file seed không tạo trùng.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly restaurants: RestaurantsService,
    private readonly search: SearchService,
    @InjectRepository(Content)
    private readonly contents: Repository<Content>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async seed(payload: SeedPayloadDto) {
    const report = {
      usersCreated: 0,
      restaurantsCreated: 0,
      restaurantsSkipped: 0,
      contentsCreated: 0,
      // UUID user để đội test copy vào mobile/src/config.ts (DEV_USER_ID)
      // — Bước 4 hướng dẫn Test Local qua Expo Go
      users: [] as { id: string; displayName: string }[],
      errors: [] as string[],
    };

    for (const u of payload.users ?? []) {
      const exists = await this.users.findOneBy({ displayName: u.displayName });
      if (exists) {
        report.users.push({ id: exists.id, displayName: exists.displayName });
        continue;
      }
      const created = await this.users.save(
        this.users.create({
          displayName: u.displayName,
          isAdmin: u.isAdmin ?? false,
        }),
      );
      report.users.push({ id: created.id, displayName: created.displayName });
      report.usersCreated++;
    }

    for (const r of payload.restaurants ?? []) {
      const exists = await this.restaurants.findByName(r.name);
      if (exists) {
        report.restaurantsSkipped++;
        continue;
      }
      await this.restaurants.create(r);
      report.restaurantsCreated++;
    }

    for (const c of payload.contents ?? []) {
      const restaurant = await this.restaurants.findByName(c.restaurantName);
      if (!restaurant) {
        report.errors.push(`Không tìm thấy quán: "${c.restaurantName}"`);
        continue;
      }
      const dup = await this.contents.findOneBy({ sourceUrl: c.sourceUrl });
      if (dup) continue; // idempotent theo source_url
      await this.contents.save(
        this.contents.create({
          restaurantId: restaurant.id,
          userId: null, // post tổng hợp — không gắn user, credit qua sourceAuthor
          mediaType: c.mediaType,
          // Spike 1: Threads cấm lưu nội dung — chỉ giữ URL, caption lấy
          // qua oEmbed lúc hiển thị (DB cũng chặn bằng CHECK constraint)
          caption: c.sourcePlatform === 'threads' ? null : (c.caption ?? null),
          origin: 'aggregated',
          sourcePlatform: c.sourcePlatform,
          sourceUrl: c.sourceUrl,
          sourceAuthor: c.sourceAuthor,
          occasions: c.occasions ?? [],
        }),
      );
      report.contentsCreated++;
    }

    // Cập nhật search index ngay sau seed
    try {
      await this.search.reindex();
    } catch {
      report.errors.push(
        'Reindex thất bại — Typesense chưa chạy? Gọi lại POST /admin/search/reindex sau.',
      );
    }

    return report;
  }
}
