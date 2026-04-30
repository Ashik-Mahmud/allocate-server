

// generate staff list filter dto using zod
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"
import { TransactionType } from '@prisma/client';

export const StaffFilterSchema = z.object({
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(9999, 'Limit cannot exceed 9999').default(10),
    search: z.string().optional(),
    email: z.string().email().optional(),
    org_id: z.string().optional(),
});

export const CreditLogsFilterSchema = z.object({
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    search: z.string().optional(),
    type: z.enum(Object.values(TransactionType)).optional(),
});
export class StaffFilterDto extends createZodDto(StaffFilterSchema) { }
export class CreditLogsFilterDto extends createZodDto(CreditLogsFilterSchema) { }