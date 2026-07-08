import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Event tracking cho pilot (chỉ số mục 8 concept gốc).
 * Quyết định v0: log thẳng Postgres thay vì PostHog/Amplitude —
 * quy mô Quận 7 hoàn toàn trong tầm, số liệu ở cùng chỗ với dữ liệu chính
 * (query retention/verified-ratio bằng SQL), không thêm dịch vụ ngoài.
 */
@Entity('events')
export class AppEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  /** Thiết bị chưa đăng nhập — client tự sinh uuid, giữ trong AsyncStorage */
  @Column({ name: 'anon_id', type: 'text', nullable: true })
  anonId: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
