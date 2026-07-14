import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content } from '../../entities/content.entity';

/**
 * oEmbed tại thời điểm hiển thị — kết luận Spike 1 (03/07/2026):
 * - TikTok: oEmbed công khai, ĐƯỢC nhúng. https://www.tiktok.com/oembed?url=...
 * - Threads: điều khoản CẤM lưu trữ nội dung → DB chỉ giữ source_url,
 *   nội dung lấy qua oEmbed lúc render. Đã xác nhận thực tế (PO test 200):
 *   endpoint tokenless https://graph.threads.net/v1.0/oembed?url=... —
 *   KHÔNG cần Meta App / access token.
 *
 * Cache in-memory TTL: đủ cho pilot 1 instance; chuyển Redis khi scale
 * ngang. Cache là "hiển thị tạm", không phải lưu trữ — TTL ngắn (24h)
 * và mất khi restart, không ghi xuống đĩa.
 */

const TTL_MS = 24 * 3_600_000;
const MAX_CACHE = 2_000;

export interface OembedResult {
  provider: 'tiktok' | 'threads';
  authorName: string | null;
  /** Caption/text của post gốc (Threads) hoặc title (TikTok) */
  text: string | null;
  /** HTML nhúng do provider cấp — client render trong WebView nếu muốn */
  html: string | null;
  thumbnailUrl: string | null;
}

interface CacheEntry {
  at: number;
  value: OembedResult;
}

@Injectable()
export class OembedService {
  private readonly logger = new Logger(OembedService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(Content)
    private readonly contents: Repository<Content>,
  ) {}

  async forContent(contentId: string): Promise<OembedResult> {
    const content = await this.contents.findOneBy({ id: contentId });
    if (!content) throw new NotFoundException('Không tìm thấy nội dung');
    if (content.origin !== 'aggregated' || !content.sourceUrl || !content.sourcePlatform) {
      throw new BadRequestException('Nội dung này không phải post tổng hợp');
    }

    return this.fetchForUrl(content.sourcePlatform, content.sourceUrl);
  }

  /** Fetch oEmbed theo URL (có cache TTL) — dùng cho cả reindex thumbnail */
  async fetchForUrl(
    platform: 'tiktok' | 'threads',
    url: string,
  ): Promise<OembedResult> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

    const value = await this.fetchOembed(platform, url);
    if (this.cache.size >= MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(url, { at: Date.now(), value });
    return value;
  }

  private async fetchOembed(
    platform: 'tiktok' | 'threads',
    url: string,
  ): Promise<OembedResult> {
    try {
      if (platform === 'tiktok') {
        const res = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        );
        if (!res.ok) throw new Error(`tiktok oembed ${res.status}`);
        const d = (await res.json()) as Record<string, unknown>;
        return {
          provider: 'tiktok',
          authorName: (d.author_name as string) ?? null,
          text: (d.title as string) ?? null,
          html: (d.html as string) ?? null,
          thumbnailUrl: (d.thumbnail_url as string) ?? null,
        };
      }

      const res = await fetch(
        `https://graph.threads.net/v1.0/oembed?url=${encodeURIComponent(url)}`,
      );
      if (!res.ok) throw new Error(`threads oembed ${res.status}`);
      const d = (await res.json()) as Record<string, unknown>;
      return {
        provider: 'threads',
        authorName: (d.author_name as string) ?? null,
        text: null, // Threads oEmbed trả html — text nằm trong embed, không tách lưu
        html: (d.html as string) ?? null,
        thumbnailUrl: null,
      };
    } catch (e) {
      this.logger.warn(`oEmbed ${platform} lỗi: ${e}`);
      throw new ServiceUnavailableException(
        'Không lấy được nội dung từ nền tảng gốc — thử lại sau',
      );
    }
  }
}
