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
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"
import { meta } from 'zod/v4/core';

export const UpdateSystemSettingsDtoSchema = z.object({
    maintenance_mode: z.boolean().optional(),
    global_alert_message: z.record(z.string(), z.any()).optional(),
    support_email: z.string().email().optional(),
    features_flags: z.record(z.string(), z.boolean()).optional(),
});

export const BroadcastAnnouncementSchema = z.object({
    title: z.string(),
    message: z.string(),
    userIds: z.array(z.string()).optional(),
    type: z.enum(['SYSTEM_ALERT', 'MAINTENANCE_NOTICE']).default('SYSTEM_ALERT'),
    metadata: z.record(z.string(), z.any()).optional(),
    receiverType: z.enum(['ALL', 'ORG', 'STAFF', 'INDIVIDUAL']).default('ALL'),
});


export const OrganizationFilterSchema = z.object({
    organizationId: z.string().optional(),
    name: z.string().optional(),
    verified: z.boolean().optional(),
    page: z.number().default(1),
    limit: z.number().default(10),
    search: z.string().optional(),
});

export const OrganizationCreditTopUpSchema = z.object({
    amount: z.number().positive(),
    price: z.number().positive(),
});


export const AllUserFilterSchema = z.object({
    organizationId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    role: z.enum(['STAFF', 'ADMIN']).optional(),
    page: z.number().default(1),
    limit: z.number().default(10),
    search: z.string().optional(),
});

export class UpdateSystemSettingsDto extends createZodDto(UpdateSystemSettingsDtoSchema) { }
export class BroadcastAnnouncementDto extends createZodDto(BroadcastAnnouncementSchema) { }
export class OrganizationFilterDto extends createZodDto(OrganizationFilterSchema) { }
export class OrganizationCreditTopUpDto extends createZodDto(OrganizationCreditTopUpSchema) { }
export class AllUserFilterDto extends createZodDto(AllUserFilterSchema) { }