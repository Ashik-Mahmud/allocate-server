
// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"

// DTO for creating a resource
export const CreateResourceSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.string().min(1, 'Type is required'),
    hourly_rate: z.number().min(1, 'Hourly rate is required'),
    metadata: z.record(z.string(), z.any()).optional(),
    is_available: z.boolean().default(true),
    is_active: z.boolean().default(true),
    is_maintenance: z.boolean().default(false),
});

// DTO for updating a resource
export const UpdateResourceSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    type: z.string().min(1, 'Type is required').optional(),
    hourly_rate: z.number().min(1, 'Hourly rate is required').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    is_available: z.boolean().optional(),
    is_active: z.boolean().optional(),
    is_maintenance: z.boolean().optional(),
});

export class CreateResourceDto extends createZodDto(CreateResourceSchema) { }
export class UpdateResourceDto extends createZodDto(UpdateResourceSchema) { }
