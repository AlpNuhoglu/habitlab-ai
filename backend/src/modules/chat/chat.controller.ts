import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { THROTTLE_TIERS } from '../../common/throttler/throttle-tiers';
import { ChatService } from './chat.service';
import { ChatHistoryDto, ChatMessageDto } from './dto/chat-message.dto';
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

  // LLM calls are the most expensive endpoint to abuse. This burst limit
  // complements the per-user daily quota and system budget gates inside
  // ChatService — it stops a rapid flood from hammering the provider and
  // tripping the circuit breaker for everyone.
  @Throttle({
    default: { limit: THROTTLE_TIERS.chat.limit, ttl: THROTTLE_TIERS.chat.ttl },
  })
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

  @Delete('history')
  @HttpCode(204)
  @ApiOperation({ summary: 'Clear the entire conversation history for a fresh start' })
  @ApiResponse({ status: 204, description: 'History cleared' })
  async clearHistory(@Req() req: Request): Promise<void> {
    const { sub: userId } = getUser(req);
    await this.chatService.clearHistory(userId);
  }
}
