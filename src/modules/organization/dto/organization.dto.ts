
// Organization DTOs

// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    org_type: z.string().optional(),
    tagline: z.string().optional(),
    photo: z.string().optional(),
    plan_type: z.string().optional(),
    credit_pool: z.number().optional(),
    is_active: z.boolean().optional(),
});

export const UpdateOrganizationSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    org_type: z.string().optional(),
    tagline: z.string().optional(),
    photo: z.string().optional(),
    plan_type: z.string().optional(),
    credit_pool: z.number().optional(),
    is_active: z.boolean().optional(),
});


export class CreateOrganizationDto extends createZodDto(CreateOrganizationSchema) { }
export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) { }
