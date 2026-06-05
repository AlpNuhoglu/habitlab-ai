import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { ChatService } from './chat.service';
import type { ChatHistoryDto, ChatMessageDto } from './dto/chat-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

@ApiTags('coach')
@Controller('coach/chat')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to the AI Coach and receive a personalized reply' })
  @ApiResponse({ status: 201, description: 'Assistant reply message' })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ): Promise<ChatMessageDto> {
    const { sub: userId } = getUser(req);
    return this.chatService.sendMessage(userId, dto.message);
  }

  @Get('history')
  @ApiOperation({ summary: 'Load paginated conversation history (cursor-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'Cursor: message UUID' })
  @ApiResponse({ status: 200 })
  async getHistory(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<ChatHistoryDto> {
    const { sub: userId } = getUser(req);
    const pageSize = limit ? Math.max(1, parseInt(limit, 10)) : 50;
    return this.chatService.getHistory(userId, pageSize, before);
  }
}
