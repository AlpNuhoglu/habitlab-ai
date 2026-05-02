import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', unique: true })
  endpoint!: string;

  @Column({ name: 'keys_p256dh', type: 'text' })
  keysP256dh!: string;

  @Column({ name: 'keys_auth', type: 'text' })
  keysAuth!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
