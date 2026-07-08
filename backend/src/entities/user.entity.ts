import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  /** Map Firebase Auth — null với user seed nội bộ */
  @Column({ name: 'firebase_uid', type: 'text', nullable: true, unique: true })
  firebaseUid: string | null;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin: boolean;

  /** 0..1 — tính bởi TrustService (công thức v0, mục 4.2 tài liệu định hướng) */
  @Column({ name: 'trust_score', type: 'real', default: 0 })
  trustScore: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
