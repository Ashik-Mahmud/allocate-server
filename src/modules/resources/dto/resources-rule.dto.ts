

// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"

// DTO for creating a resource rule
export const CreateResourceRuleSchema = z.object({
    resource_id: z.string().min(1, 'Resource ID is required'),
    max_booking_hours: z.number().positive().optional(),
    min_lead_time: z.number().positive().optional(),
    buffer_time: z.number().positive().optional(),
    opening_hours: z.number().int().min(0).max(23).optional(),
    closing_hours: z.number().int().min(0).max(23).optional(),
    slot_duration_min: z.number().int().positive().optional(),
    is_weekend_allowed: z.boolean().optional(),
    availableDays: z.array(z.string()).optional()

});

// DTO for updating a resource rule
export const UpdateResourceRuleSchema = z.object({
    max_booking_hours: z.number().positive().optional(),
    min_lead_time: z.number().positive().optional(),
    buffer_time: z.number().positive().optional(),

    opening_hours: z.number().int().min(0).max(23).optional(),
    closing_hours: z.number().int().min(0).max(23).optional(),
    slot_duration_min: z.number().int().positive().optional(),
    is_weekend_allowed: z.boolean().optional(),
    availableDays: z.array(z.string()).optional()

});

export class CreateResourceRuleDto extends createZodDto(CreateResourceRuleSchema) { }
export class UpdateResourceRuleDto extends createZodDto(UpdateResourceRuleSchema) { }