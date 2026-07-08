import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Đồ thị có hướng — nền tảng cho trust score và feed cá nhân hoá */
@Entity('follows')
export class Follow {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @PrimaryColumn({ name: 'followed_id', type: 'uuid' })
  followedId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
