import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ChatRole = 'user' | 'assistant';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  role!: ChatRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'llm_model', type: 'text', nullable: true })
  llmModel!: string | null;

  @Column({ name: 'tokens_in', type: 'integer', nullable: true })
  tokensIn!: number | null;

  @Column({ name: 'tokens_out', type: 'integer', nullable: true })
  tokensOut!: number | null;

  @Column({ name: 'cost_cents', type: 'numeric', precision: 10, scale: 4, nullable: true })
  costCents!: number | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
