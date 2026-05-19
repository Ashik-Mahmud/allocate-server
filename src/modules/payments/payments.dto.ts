// create checkout dto
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PaymentProvider, PlanType } from '@prisma/client';

export const CreateCheckoutSchema = z.object({
  months: z.number().int().positive('Months must be a positive integer'),
  planType: z.enum([PlanType.PRO, PlanType.ENTERPRISE]).optional(), // Optional if you want to default to a specific plan
  currency: z.enum(['BDT', 'USD']).optional(), // Optional if you want to default to a specific currency
  payment_gateway: z
    .enum([PaymentProvider.STRIPE, PaymentProvider.SSLCOMMERZ])
    .optional(), // Optional if you want to default to a specific gateway
});

export class CreateCheckoutDto extends createZodDto(CreateCheckoutSchema) {}
