import type { ChatRole } from '../entities/chat-message.entity';

export class ChatMessageDto {
  id!: string;
  role!: ChatRole;
  content!: string;
  createdAt!: string;
}

export class ChatHistoryDto {
  messages!: ChatMessageDto[];
  hasMore!: boolean;
}
