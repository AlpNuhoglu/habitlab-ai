import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications_sent')
export class NotificationSent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'habit_id', type: 'uuid', nullable: true })
  habitId!: string | null;

  @Column({ type: 'text' })
  channel!: string;

  @Column({ name: 'variant_key', type: 'text', nullable: true })
  variantKey!: string | null;

  @Column({ name: 'template_key', type: 'text' })
  templateKey!: string;

  @Column({ name: 'rendered_body', type: 'text', nullable: true })
  renderedBody!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', default: () => 'now()' })
  sentAt!: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt!: Date | null;
}
