import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface QuietHours {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface UserPreferences {
  ai_recommendations_enabled: boolean;
  experiments_opted_out: boolean;
  hints_include_notes: boolean;
  quiet_hours: QuietHours;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // CITEXT: case-insensitive; lookups never need LOWER()
  @Column({ type: 'citext', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName!: string | null;

  @Column({ type: 'text', default: 'UTC' })
  timezone!: string;

  @Column({ type: 'text', default: 'en' })
  locale!: string;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'consent_given_at', type: 'timestamptz' })
  consentGivenAt!: Date;

  @Column({
    type: 'jsonb',
    default: () =>
      `'{"ai_recommendations_enabled":true,"experiments_opted_out":false,"hints_include_notes":false,"quiet_hours":{"start":"22:00","end":"07:00"}}'`,
  })
  preferences!: UserPreferences;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
