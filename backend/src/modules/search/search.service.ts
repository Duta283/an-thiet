import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Typesense from 'typesense';
import { OembedService } from '../oembed/oembed.service';

const COLLECTION = 'restaurants';

/**
 * Typesense (mục 3): faceted search món/khu vực/giá/dịp + geo, self-host.
 * Index = quán + dữ liệu gộp từ nội dung (occasions, verified_count) —
 * đây chính là "lớp tìm kiếm có cấu trúc trên nội dung xác thực".
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly client = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST || 'localhost',
        port: Number(process.env.TYPESENSE_PORT || 8108),
        // 'https' khi Typesense expose qua public domain (Railway private net là IPv6, Typesense không bind được — bẫy #5)
        protocol: process.env.TYPESENSE_PROTOCOL || 'http',
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY || 'anthiet_dev_ts_key',
    connectionTimeoutSeconds: 5,
  });

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly oembed: OembedService,
  ) {}

  private async ensureCollection() {
    try {
      await this.client.collections(COLLECTION).retrieve();
    } catch {
      await this.client.collections().create({
        name: COLLECTION,
        fields: [
          { name: 'name', type: 'string' },
          { name: 'address', type: 'string', optional: true },
          { name: 'area', type: 'string', facet: true },
          { name: 'cuisine_types', type: 'string[]', facet: true },
          { name: 'occasions', type: 'string[]', facet: true },
          { name: 'price_min', type: 'int32', optional: true },
          { name: 'price_max', type: 'int32', optional: true },
          { name: 'verified_count', type: 'int32' },
          { name: 'content_count', type: 'int32' },
          { name: 'thumbnail_url', type: 'string', optional: true },
          { name: 'location', type: 'geopoint' },
        ],
        default_sorting_field: 'verified_count',
      });
    }
  }

  /**
   * Đồng bộ toàn bộ index từ Postgres (nguồn sự thật duy nhất).
   * Gọi sau mỗi đợt seed; khi scale chuyển sang sync incremental.
   */
  async reindex() {
    // Drop & rebuild: reindex phải phản ánh CHÍNH XÁC Postgres hiện tại,
    // kể cả những bản ghi đã bị xoá — upsert đơn thuần sẽ để lại document ma.
    try {
      await this.client.collections(COLLECTION).delete();
    } catch {
      // collection chưa tồn tại — bỏ qua
    }
    await this.ensureCollection();
    const rows = await this.dataSource.query(
      `SELECT r.id, r.name, r.address, r.area, r.thumbnail_url,
              r.cuisine_types, r.price_min, r.price_max, r.lat, r.lng,
              coalesce((
                SELECT array_agg(DISTINCT o) FROM contents c, unnest(c.occasions) o
                WHERE c.restaurant_id = r.id AND c.is_hidden = false
              ), '{}') AS occasions,
              (SELECT count(*)::int FROM contents c
                WHERE c.restaurant_id = r.id AND c.is_hidden = false) AS content_count,
              (SELECT count(*)::int FROM contents c
                WHERE c.restaurant_id = r.id AND c.is_hidden = false
                  AND EXISTS (SELECT 1 FROM verifications v
                              WHERE v.content_id = c.id AND v.result = 'passed')
              ) AS verified_count
       FROM restaurants r`,
    );
    if (rows.length === 0) return { indexed: 0 };

    // Doc 11 mục 1: thumbnail từ TikTok oEmbed cho card — chỉ lưu URL,
    // lấy qua oEmbed hợp lệ (Spike 1), fail thì bỏ qua (card fallback emoji).
    const tiktokUrls: { restaurant_id: string; source_url: string }[] =
      await this.dataSource.query(
        `SELECT DISTINCT ON (c.restaurant_id) c.restaurant_id, c.source_url
         FROM contents c
         WHERE c.source_platform = 'tiktok' AND c.is_hidden = false
           AND c.source_url IS NOT NULL
         ORDER BY c.restaurant_id, c.created_at DESC`,
      );
    const thumbs = new Map<string, string>();
    for (const t of tiktokUrls) {
      try {
        const o = await this.oembed.fetchForUrl('tiktok', t.source_url);
        if (o.thumbnailUrl) {
          thumbs.set(t.restaurant_id, o.thumbnailUrl);
          await this.dataSource.query(
            'UPDATE restaurants SET thumbnail_url = $1 WHERE id = $2',
            [o.thumbnailUrl, t.restaurant_id],
          );
        }
      } catch {
        // URL seed giả / provider lỗi — card dùng fallback emoji
      }
    }

    const docs = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      address: r.address ?? '',
      area: r.area,
      cuisine_types: r.cuisine_types ?? [],
      occasions: r.occasions ?? [],
      price_min: r.price_min ?? 0,
      price_max: r.price_max ?? 0,
      verified_count: r.verified_count,
      content_count: r.content_count,
      thumbnail_url: thumbs.get(r.id) ?? r.thumbnail_url ?? '',
      location: [r.lat, r.lng],
    }));
    await this.client
      .collections(COLLECTION)
      .documents()
      .import(docs, { action: 'upsert' });
    return { indexed: docs.length };
  }

  /**
   * Search có cấu trúc: từ khoá + facet (khu vực/món/giá/dịp) + geo.
   * Xếp hạng: text match, rồi verified_count — nội dung xác thực đẩy quán
   * lên trên, KHÔNG phải ngân sách quảng cáo (đúng nguyên tắc concept).
   */
  async search(params: {
    q?: string;
    area?: string;
    cuisine?: string;
    occasion?: string;
    priceMax?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) {
    const filters: string[] = [];
    if (params.area) filters.push(`area:=${params.area}`);
    if (params.cuisine) filters.push(`cuisine_types:=${params.cuisine}`);
    if (params.occasion) filters.push(`occasions:=${params.occasion}`);
    if (params.priceMax) {
      // price_max=0 trong index nghĩa là quán chưa có dữ liệu giá — không loại
      filters.push(`price_min:<=${params.priceMax}`);
      filters.push(`price_max:<=${params.priceMax}`);
    }
    if (params.lat !== undefined && params.lng !== undefined) {
      filters.push(
        `location:(${params.lat}, ${params.lng}, ${params.radiusKm ?? 3} km)`,
      );
    }
    try {
      const res = await this.client
        .collections(COLLECTION)
        .documents()
        .search({
          q: params.q || '*',
          query_by: 'name,cuisine_types,occasions,address',
          filter_by: filters.join(' && ') || undefined,
          sort_by: '_text_match:desc,verified_count:desc',
          per_page: 30,
        });
      return {
        found: res.found,
        hits: (res.hits ?? []).map((h) => h.document),
      };
    } catch (e) {
      this.logger.error(`Typesense không phản hồi: ${e}`);
      throw new ServiceUnavailableException(
        'Search engine chưa sẵn sàng — kiểm tra Typesense container và chạy POST /admin/search/reindex',
      );
    }
  }
}
