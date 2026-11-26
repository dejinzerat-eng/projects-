import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { ZodPipe } from '../common/zod';
import { ReportsService } from './reports.service';

const ResolveDto = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), note: z.string().trim().max(1000).optional() });

/** Nahlášení: otevřená (sloučená podle cíle) a historie vyřízených/zamítnutých s poznámkou. */
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private reports: ReportsService) {}

  @Can('reports.read')
  @Get()
  list(@Query('status') status?: string) {
    return this.reports.list(z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).catch('OPEN').parse(status ?? 'OPEN'));
  }

  @Can('reports.handle')
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(ResolveDto)) dto: z.infer<typeof ResolveDto>) {
    return this.reports.resolve(id, u, dto.status, dto.note || undefined);
  }
}
