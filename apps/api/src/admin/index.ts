import { AdminContentController, PublicSettingsController } from './admin-content.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminController } from './admin.controller';
import { ListingPolicyService } from './listing-policy.service';
import { ReportsService } from './reports.service';
import { SettingsService } from './settings.service';
import { TrustService } from './trust.service';

/** Administrace (WP6) – registruje se v AppModule. */
export const ADMIN_CONTROLLERS = [AdminController, AdminUsersController, AdminContentController, AdminReportsController, PublicSettingsController];
export const ADMIN_PROVIDERS = [SettingsService, TrustService, ReportsService, ListingPolicyService];
export { ListingPolicyService, ReportsService, SettingsService, TrustService };
