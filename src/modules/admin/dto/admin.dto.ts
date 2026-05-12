/* model SystemSettings {
  id                   String   @id @default("global_config")
  maintenance_mode     Boolean  @default(false)
  global_alert_message Json?
  support_email        String?
  features_flags       Json?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@map("system_settings")
}
 */


// Write admin system setting dto using zod schema
import { string, z } from 'zod';
import { createZodDto } from "nestjs-zod"
import { meta } from 'zod/v4/core';
import { PlanType, Role } from '@prisma/client';

export const UpdateSystemSettingsDtoSchema = z.object({
    maintenance_mode: z.boolean().optional(),
    global_alert_message: z.record(z.string(), z.any()).optional(),
    support_email: z.string().email().optional(),
    features_flags: z.record(z.string(), z.boolean()).optional(),
});

export const BroadcastAnnouncementSchema = z.object({
    title: z.string(),
    message: z.string(),
    orgIds: z.array(z.string()).optional(),
    type: z.enum(['SYSTEM_ALERT', 'MAINTENANCE_NOTICE']).default('SYSTEM_ALERT'),
    metadata: z.record(z.string(), z.any()).optional(),
    receiverType: z.enum(['ALL', 'ORG', 'STAFF', 'INDIVIDUAL']).default('ALL'),

});


export const OrganizationFilterSchema = z.object({
    organizationId: z.string().optional(),
    name: z.string().optional(),
    verified: z
        .preprocess((val) => String(val).toLowerCase(), // Force to lowercase string first
            z.enum(['true', 'false'])
        )
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    search: z.string().optional(),
    showDeletedOrg: z
        .preprocess((val) => String(val).toLowerCase(), // Force to lowercase string first
            z.enum(['true', 'false'])
        )
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
    planType: z.enum([PlanType.FREE, PlanType.PRO, PlanType.ENTERPRISE]).optional(),
});

// update organization details dto
export const UpdateOrganizationSchema = z.object({
    name: z.string().optional(),
    isVerified: z.boolean().optional(),
    hasUsedTrial: z.boolean().optional(),
    isTrialAllowed: z.boolean().optional(),
    is_active: z.boolean().optional(),
    needUpdateOrg: z.boolean().optional(),
    trialEndsAt: z.string().optional(),
});

export const OrganizationCreditTopUpSchema = z.object({
    amount: z.number().positive(),
    price: z.number().positive(),
});


export const AllUserFilterSchema = z.object({
    organizationId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum([Role.STAFF, Role.ORG_ADMIN]).optional(),
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    search: z.string().optional(),
});

export const SubscriptionTransactionFilterSchema = z.object({
    organizationId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    type: z.string().optional(),
});


export const RevenueAnalyticsFilterSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    groupBy: z.enum(['day', 'week', 'month']).optional(),
    organizationId: z.string().optional(),
});

export const UserActivityLogFilterSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
});

export class UpdateSystemSettingsDto extends createZodDto(UpdateSystemSettingsDtoSchema) { }
export class BroadcastAnnouncementDto extends createZodDto(BroadcastAnnouncementSchema) { }
export class OrganizationFilterDto extends createZodDto(OrganizationFilterSchema) { }
export class OrganizationCreditTopUpDto extends createZodDto(OrganizationCreditTopUpSchema) { }
export class AllUserFilterDto extends createZodDto(AllUserFilterSchema) { }
export class SubscriptionTransactionFilterDto extends createZodDto(SubscriptionTransactionFilterSchema) { }
export class RevenueAnalyticsFilterDto extends createZodDto(RevenueAnalyticsFilterSchema) { }
export class UserActivityLogFilterDto extends createZodDto(UserActivityLogFilterSchema) { }
export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) { }
