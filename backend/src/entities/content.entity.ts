import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ContentOrigin = 'user_generated' | 'aggregated';
export type MediaType = 'video' | 'image' | 'text';
export type SourcePlatform = 'tiktok' | 'threads';

/**
 * Post tổng hợp (aggregated) từ TikTok/Threads:
 * - BẮT BUỘC có sourceUrl + sourceAuthor + sourcePlatform (CHECK constraint trong DB)
 * - KHÔNG BAO GIỜ có verification — hiển thị khác biệt rõ với post đã xác thực
 */
@Entity('contents')
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'media_type', type: 'text' })
  mediaType: MediaType;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @Column({ type: 'text' })
  origin: ContentOrigin;

  @Column({ name: 'source_platform', type: 'text', nullable: true })
  sourcePlatform: SourcePlatform | null;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'source_author', type: 'text', nullable: true })
  sourceAuthor: string | null;

  /** Dịp: 'hen-ho', 'gia-dinh', 'an-khuya', 'cong-viec'... — facet search */
  @Column({ type: 'text', array: true, default: '{}' })
  occasions: string[];

  /** Ảnh check-in — URL public trên Cloudflare R2 */
  @Column({ name: 'photo_urls', type: 'text', array: true, default: '{}' })
  photoUrls: string[];

  @Column({ name: 'report_count', type: 'integer', default: 0 })
  reportCount: number;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
