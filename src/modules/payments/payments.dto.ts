// create checkout dto
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PlanType } from '@prisma/client';

export const CreateCheckoutSchema = z.object({
    months: z.number().int().positive("Months must be a positive integer"),
    planType: z.enum([PlanType.PRO, PlanType.ENTERPRISE]).optional(), // Optional if you want to default to a specific plan
    currency: z.enum(['BDT', 'USD']).optional(), // Optional if you want to default to a specific currency
});

export class CreateCheckoutDto extends createZodDto(CreateCheckoutSchema) { }