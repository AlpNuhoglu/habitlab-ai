import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HabitLogStatus = 'completed' | 'skipped';

@Entity('habit_logs')
@Check('habit_logs_note_length', `note IS NULL OR char_length(note) <= 500`)
export class HabitLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'habit_id', type: 'uuid' })
  habitId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // DATE column — TypeORM returns as string 'YYYY-MM-DD' when no entity transform
  @Column({ name: 'log_date', type: 'date' })
  logDate!: string;

  @Column({
    type: 'enum',
    enum: ['completed', 'skipped'],
  })
  status!: HabitLogStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'logged_at', type: 'timestamptz' })
  loggedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
