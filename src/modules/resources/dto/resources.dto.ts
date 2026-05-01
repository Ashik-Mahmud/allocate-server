
// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"

// DTO for creating a resource
export const CreateResourceSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.string().min(1, 'Type is required'),
    hourly_rate: z.number().min(1, 'Hourly rate is required'),
    photo: z.string().url('Photo must be a valid URL').optional(),
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
    photo: z.string().url('Photo must be a valid URL').optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    is_available: z.boolean().optional(),
    is_active: z.boolean().optional(),
    is_maintenance: z.boolean().optional(),
});

export class CreateResourceDto extends createZodDto(CreateResourceSchema) { }
export class UpdateResourceDto extends createZodDto(UpdateResourceSchema) { }

// DTO for listing/searching resources with pagination
export const ListResourcesQuerySchema = z.object({
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    search: z.string().optional(),
    type: z.string().optional(),
    is_available: z
        .preprocess((val) => String(val).toLowerCase(), // Force to lowercase string first
            z.enum(['true', 'false'])
        )
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
    is_active: z
        .preprocess((val) => String(val).toLowerCase(), // Force to lowercase string first
            z.enum(['true', 'false'])
        )
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
    is_maintenance: z
        .preprocess((val) => String(val).toLowerCase(), // Force to lowercase string first
            z.enum(['true', 'false'])
        )
        .optional()
        .transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
    sortBy: z.enum(['name', 'hourly_rate', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export class ListResourcesQueryDto extends createZodDto(ListResourcesQuerySchema) { }
