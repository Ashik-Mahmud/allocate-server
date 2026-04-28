/* model User {
  id               String         @id @default(cuid())
  email            String         @unique
  password         String
  name             String
  photo            String?
  personal_credits Int?
  role             Role           @default(ORG_ADMIN)
  last_login       DateTime?
  deletedAt        DateTime?
  createdAt        DateTime?      @default(now())
  updatedAt        DateTime?      @updatedAt
  org_id           String?
  organization     Organizations? @relation(fields: [org_id], references: [id], onDelete: Cascade)
  notifications    Notification[]
  bookings         Bookings[]     @relation("BookingUser")
  createdBookings  Bookings[]     @relation("BookingCreator")

  @@index([email, org_id])
  @@map("users")
} */

// Write staff dto code using zod 
import { email, z } from 'zod';
import { createZodDto } from "nestjs-zod"

export const CreateStaffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, 'Name is required'),
  password: z.string().optional(),
  photo: z.string().optional(),
  org_id: z.string().optional(),
});

export const UpdateStaffSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1, 'Name is required').optional(),
  password: z.string().optional(),
  photo: z.string().optional(),
  org_id: z.string().optional(),
});


export const ManageCreditsSchema = z.object({
  credits: z.number().int().nonnegative(),
});

export const ManageMultipleStaffCreditsSchema = z.object({
  // an array with object with staff_id and credits
  staffCredits: z.array(z.object({
    staff_id: z.string(),
    credits: z.number().int().nonnegative(),
  })),
});

export class CreateStaffDto extends createZodDto(CreateStaffSchema) { }
export class UpdateStaffDto extends createZodDto(UpdateStaffSchema) { }
export class ManageCreditsDto extends createZodDto(ManageCreditsSchema) { }
export class ManageMultipleStaffCreditsDto extends createZodDto(ManageMultipleStaffCreditsSchema) { }