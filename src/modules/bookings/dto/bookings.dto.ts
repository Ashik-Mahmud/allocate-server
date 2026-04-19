/* model Bookings {
  id                  String         @id @default(cuid())
  user_id             String
  resource_id         String
  org_id              String
  start_time          DateTime
  end_time            DateTime
  total_cost          Decimal
  status              BookingStatus? @default(PENDING)
  cancellation_reason String?
  deletedAt           DateTime?
  createdAt           DateTime?       @default(now())
  updatedAt           DateTime?       @updatedAt

  user               User                @relation(fields: [user_id], references: [id], onDelete: Cascade)
  organization       Organizations       @relation(fields: [org_id], references: [id], onDelete: Cascade)
  resource           Resources           @relation(fields: [resource_id], references: [id], onDelete: Cascade)
  creditTransactions CreditTransaction[]

  @@index([user_id, resource_id, org_id])
  @@map("bookings")
} */

// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from "nestjs-zod"
// DTO for creating a booking
export const CreateBookingSchema = z.object({
    user_id: z.string().min(1, 'User ID is required'),
    resource_id: z.string().min(1, 'Resource ID is required'),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    notes: z.string().optional(), // Optional notes field for additional booking information
    metadata: z.record(z.string(), z.any()).optional(), // Optional metadata field for additional booking information
});

// DTO for updating a booking
export const UpdateBookingSchema = z.object({
    start_time: z.string().min(1, 'Start time is required').optional(),
    end_time: z.string().min(1, 'End time is required').optional(),
    notes: z.string().optional(), // Optional notes field for additional booking information
    metadata: z.record(z.string(), z.any()).optional(), // Optional metadata field for additional booking information
});

export class CreateBookingDto extends createZodDto(CreateBookingSchema) { }