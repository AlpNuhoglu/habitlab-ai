import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Public()
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Res() res: Response): Promise<void> {
    const output = await this.metricsService.registry.metrics();
    res.send(output);
  }
}
