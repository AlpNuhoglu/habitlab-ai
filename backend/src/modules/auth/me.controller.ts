import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotImplementedException,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { RequestUser } from './auth.controller';
import { UpdateProfileDto } from './dto/update-profile.dto';

function getUser(req: Request): RequestUser {
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new Error('Guard failed to populate req.user');
  return authed.user;
}

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get authenticated user profile (FR-009)' })
  @ApiResponse({ status: 200, description: 'User profile.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async getMe(@Req() req: Request) {
    const user = getUser(req);
    return this.authService.getMe(user.sub);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update authenticated user profile (FR-009)' })
  @ApiResponse({ status: 200, description: 'Updated profile.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async patchMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const user = getUser(req);
    return this.authService.updateMe(user.sub, dto);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request account deletion (FR-010) — not yet implemented' })
  @ApiResponse({ status: 501, description: 'Not implemented.' })
  deleteMe(): never {
    throw new NotImplementedException('Account deletion is not yet available.');
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export personal data (FR-010) — not yet implemented' })
  @ApiResponse({ status: 501, description: 'Not implemented.' })
  exportMe(): never {
    throw new NotImplementedException('Data export is not yet available.');
  }
}
