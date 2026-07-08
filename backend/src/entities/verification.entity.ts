import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type VerificationMethod = 'gps' | 'exif' | 'qr';
export type VerificationResult = 'passed' | 'failed' | 'pending';

/**
 * Tách riêng khỏi Content (mục 2.1) để:
 * - 1 content có thể có nhiều verification (GPS + EXIF cùng lúc)
 * - cắm thêm phương thức mới (QR hoá đơn giai đoạn 2, Incognia khi scale)
 *   mà không đổi schema Content.
 */
@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_id', type: 'uuid' })
  contentId: string;

  @Column({ type: 'text' })
  method: VerificationMethod;

  @Column({ type: 'text' })
  result: VerificationResult;

  @Column({ type: 'real', nullable: true })
  confidence: number | null;

  /** Bằng chứng thô (toạ độ, accuracy, EXIF...) — phục vụ audit & debug chống gian lận */
  @Column({ name: 'raw_evidence', type: 'jsonb', nullable: true })
  rawEvidence: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
