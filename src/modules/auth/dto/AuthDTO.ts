import { z } from 'zod';
import { passwordSchema, emailSchema } from '../../../utils/validators';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required').default('Client Name'),
  // optional fields
  //photo: z.string().optional(),

});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});


export class RegisterDto extends createZodDto(RegisterSchema) {} 
export class LoginDto extends createZodDto(RegisterSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}