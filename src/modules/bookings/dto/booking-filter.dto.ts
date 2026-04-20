
// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"

// DTO for listing/searching resources with pagination
export const MyBookingsHistoryQuerySchema = z.object({
    page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
    search: z.string().optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']).optional(),
});


export const AllBookingsQuerySchema = MyBookingsHistoryQuerySchema.extend({
    userId: z.string().optional(),
    resourceId: z.string().optional(),
    dateRange: z.string().optional(), // e.g. "2024-01-01 to 2024-01-07"
});



export class MyBookingsHistoryQueryDto extends createZodDto(MyBookingsHistoryQuerySchema) { }
export class AllBookingsQueryDto extends createZodDto(AllBookingsQuerySchema) { }