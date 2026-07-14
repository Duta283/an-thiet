import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Restaurant } from '../../entities/restaurant.entity';
import { CreateRestaurantDto, ListRestaurantsQuery } from './dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly repo: Repository<Restaurant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateRestaurantDto): Promise<Restaurant> {
    const r = this.repo.create({
      name: dto.name,
      address: dto.address ?? null,
      area: dto.area,
      cuisineTypes: dto.cuisineTypes ?? [],
      priceMin: dto.priceMin ?? null,
      priceMax: dto.priceMax ?? null,
      lat: dto.lat,
      lng: dto.lng,
      source: dto.source ?? 'manual',
      sourceRef: dto.sourceRef ?? null,
    });
    return this.repo.save(r);
  }

  /**
   * Tìm quán: nếu có lat/lng thì geo-query PostGIS (ST_DWithin trên cột
   * geography có GIST index — nhanh hơn nhiều so với tính toạ độ thủ công,
   * đúng lý do chọn PostGIS ở mục 3).
   */
  async list(q: ListRestaurantsQuery) {
    if (q.lat !== undefined && q.lng !== undefined) {
      const radius = q.radius ?? 3000;
      const params: unknown[] = [q.lng, q.lat, radius];
      let filters = '';
      if (q.area) {
        params.push(q.area);
        filters += ` AND r.area = $${params.length}`;
      }
      if (q.cuisine) {
        params.push(q.cuisine);
        filters += ` AND $${params.length} = ANY(r.cuisine_types)`;
      }
      if (q.priceMax !== undefined) {
        params.push(q.priceMax);
        // Chặn cả trần giá: quán khởi điểm rẻ nhưng trần cao không lọt filter giá thấp
        filters += ` AND (r.price_min IS NULL OR r.price_min <= $${params.length})`;
        filters += ` AND (r.price_max IS NULL OR r.price_max <= $${params.length})`;
      }
      return this.dataSource.query(
        `SELECT r.id, r.name, r.address, r.area, r.cuisine_types AS "cuisineTypes",
                r.price_min AS "priceMin", r.price_max AS "priceMax",
                r.thumbnail_url AS "thumbnailUrl",
                r.lat, r.lng,
                round(ST_Distance(
                  r.location,
                  ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                )) AS "distanceM"
         FROM restaurants r
         WHERE ST_DWithin(
                 r.location,
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                 $3
               )${filters}
         ORDER BY "distanceM" ASC
         LIMIT 50`,
        params,
      );
    }

    const qb = this.repo.createQueryBuilder('r').limit(50);
    if (q.area) qb.andWhere('r.area = :area', { area: q.area });
    if (q.cuisine)
      qb.andWhere(':cuisine = ANY(r.cuisine_types)', { cuisine: q.cuisine });
    if (q.priceMax !== undefined)
      qb.andWhere(
        '(r.price_min IS NULL OR r.price_min <= :pm) AND (r.price_max IS NULL OR r.price_max <= :pm)',
        { pm: q.priceMax },
      );
    return qb.getMany();
  }

  /** Chi tiết quán + số liệu nội dung (tổng / đã xác thực) */
  async detail(id: string) {
    const restaurant = await this.repo.findOneBy({ id });
    if (!restaurant) throw new NotFoundException('Không tìm thấy quán');
    const [stats] = await this.dataSource.query(
      `SELECT
         count(*)::int AS "contentCount",
         count(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM verifications v
             WHERE v.content_id = c.id AND v.result = 'passed'
           )
         )::int AS "verifiedContentCount"
       FROM contents c
       WHERE c.restaurant_id = $1 AND c.is_hidden = false`,
      [id],
    );
    return { ...restaurant, ...stats };
  }

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }

  findByName(name: string) {
    return this.repo
      .createQueryBuilder('r')
      .where('lower(r.name) = lower(:name)', { name })
      .getOne();
  }
}
