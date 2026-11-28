import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ADMIN_CONTROLLERS, ADMIN_PROVIDERS } from './admin';
import { LegacyAdminController, LegacyPublicController } from './legacy/legacy.controller';
import { LegacyImportService } from './legacy/legacy-import.service';
import { BannersAdminController, BannersController } from './banners/banners.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './common/auth.guard';
import { MailerService, SmsService } from './common/mailer.service';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { HealthController } from './health.controller';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { GuestListingController } from './listings/guest-listing.controller';
import { ListingsController } from './listings/listings.controller';
import { ListingsService } from './listings/listings.service';
import { MediaController } from './media/media.controller';
import { StorageService } from './media/storage.service';
import { MessagesController } from './messages/messages.controller';
import { DiscoveryController } from './search/discovery.controller';
import { NoticesAdminController, NoticesController } from './notices/notices.controller';
import { SearchService } from './search/search.service';
import { SeoAdminController, SeoController } from './seo/seo.controller';
import { UsersController } from './users/users.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }])],
  controllers: [HealthController, AuthController, DiscoveryController, GuestListingController, ListingsController, MessagesController, UsersController, MediaController, JobsController, NoticesController, NoticesAdminController, SeoController, SeoAdminController, LegacyAdminController, LegacyPublicController, BannersController, BannersAdminController, ...ADMIN_CONTROLLERS],
  providers: [
    PrismaService, RedisService, MailerService, SmsService, StorageService, SearchService, AuthService, ListingsService, JobsService, LegacyImportService, ...ADMIN_PROVIDERS,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
