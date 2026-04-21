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

export const UpdateSystemSettingsDtoSchema = z.object({
    maintenance_mode: z.boolean().optional(),
    global_alert_message: z.string().optional(),
    support_email: z.string().email().optional(),
    features_flags: z.record(z.string(), z.boolean()).optional(),
});

export class UpdateSystemSettingsDto extends createZodDto(UpdateSystemSettingsDtoSchema) {}