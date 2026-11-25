import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JobsService } from './jobs.service';

/** Spouštění pravidelných úloh zvenčí (Vercel Cron / jiný plánovač). Chráněno tajným klíčem CRON_SECRET. */
@Controller('jobs')
export class JobsController {
  constructor(private jobs: JobsService) {}
  @Get('tick')
  async tick(@Headers('authorization') auth?: string) {
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) throw new UnauthorizedException();
    await this.jobs.tick();
    return { ok: true };
  }
}
