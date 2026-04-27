import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RecommendationsService } from './recommendations.service';

interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    @Inject(RecommendationsService)
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active recommendations (FR-050)' })
  @ApiResponse({ status: 200 })
  async listActive(@Req() req: Request) {
    const { sub: userId } = getUser(req);
    return this.recommendationsService.listActive(userId);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dismiss a recommendation (FR-051)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async dismiss(@Param('id') id: string, @Req() req: Request) {
    const { sub: userId } = getUser(req);
    try {
      await this.recommendationsService.dismiss(id, userId);
      return { success: true };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw err;
    }
  }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept a recommendation (FR-052)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  async accept(@Param('id') id: string, @Req() req: Request) {
    const { sub: userId } = getUser(req);
    await this.recommendationsService.accept(id, userId);
    return { success: true };
  }
}
