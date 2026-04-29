
// Organization DTOs

// Using Zod for validation
import { set, z } from 'zod';
import { createZodDto } from "nestjs-zod"
import { PlanType } from '@prisma/client';

export const CreateOrganizationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    org_type: z.string().optional(),
    tagline: z.string().optional(),
    photo: z.string().optional(),
    plan_type: z.nativeEnum(PlanType).optional().default(PlanType.FREE),
    credit_pool: z.number().optional(),
    is_active: z.boolean().optional(),
});

export const UpdateOrganizationSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    org_type: z.string().optional(),
    tagline: z.string().optional(),
    photo: z.string().optional(),
    is_active: z.boolean().optional(),
    timezone: z.string().optional(),
    settings: z.record(z.string(), z.any()).optional(),
    address: z.record(z.string(), z.string()).optional(),
    business_email: z.string().email().optional(),
    slug: z.string().optional(),
});


export class CreateOrganizationDto extends createZodDto(CreateOrganizationSchema) { }
export class UpdateOrganizationDto extends createZodDto(UpdateOrganizationSchema) { }
