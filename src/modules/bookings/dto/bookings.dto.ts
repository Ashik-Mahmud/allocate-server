// Using Zod for validation
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
// DTO for creating a booking
export const CreateBookingSchema = z.object({
  user_id: z.string().min(1, 'User ID is required').optional(), // This will be set from the authenticated user context, so it's optional in the DTO
  resource_id: z.string().min(1, 'Resource ID is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  notes: z.string().optional(), // Optional notes field for additional booking information
  // metadata: z.record(z.string(), z.any()).optional(), // Optional metadata field for additional booking information
});

// DTO for updating a booking
export const UpdateBookingSchema = z.object({
  //start_time: z.string().min(1, 'Start time is required').optional(),
  //end_time: z.string().min(1, 'End time is required').optional(),
  notes: z.string().optional(), // Optional notes field for additional booking information
  //metadata: z.record(z.string(), z.any()).optional(), // Optional metadata field for additional booking information
});

// DTO for booking status update
export const UpdateBookingStatusSchema = z.object({
  cancellation_reason: z.string().optional(), // Optional cancellation reason when status is CANCELLED
  status: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'REJECTED',
      'CANCELLED',
      'COMPLETED',
      'CHECKED_IN',
    ])
    .optional(),
});

// DTO reschedule booking
export const RescheduleBookingSchema = z.object({
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
});

export class CreateBookingDto extends createZodDto(CreateBookingSchema) {}
export class UpdateBookingDto extends createZodDto(UpdateBookingSchema) {}
export class UpdateBookingStatusDto extends createZodDto(
  UpdateBookingStatusSchema,
) {}
export class RescheduleBookingDto extends createZodDto(
  RescheduleBookingSchema,
) {}
