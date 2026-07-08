import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** "Quán để dành" — giữ đơn giản ở MVP đúng định hướng */
@Entity('saved_items')
export class SavedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId: string;

  @Column({ name: 'list_name', type: 'text', default: 'Để dành' })
  listName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
