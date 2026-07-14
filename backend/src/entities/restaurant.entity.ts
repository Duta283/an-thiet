import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** Khu vực, vd 'quan-7' — pilot giới hạn Quận 7, TP.HCM */
  @Column({ type: 'text' })
  area: string;

  @Column({ name: 'cuisine_types', type: 'text', array: true, default: '{}' })
  cuisineTypes: string[];

  @Column({ name: 'price_min', type: 'integer', nullable: true })
  priceMin: number | null;

  @Column({ name: 'price_max', type: 'integer', nullable: true })
  priceMax: number | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  // Cột `location` (geography) là GENERATED trong DB — không map vào entity,
  // geo-query dùng raw SQL qua PostGIS (xem RestaurantsService.findNearby).

  @Column({ type: 'text', default: 'manual' })
  source: 'manual' | 'google_places';

  @Column({ name: 'source_ref', type: 'text', nullable: true })
  sourceRef: string | null;

  /** Ảnh card lấy từ TikTok oEmbed — reindex tự cập nhật, không nhập tay */
  @Column({ name: 'thumbnail_url', type: 'text', nullable: true })
  thumbnailUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
