import { z } from 'zod';

export const CreateShiftSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  rate: z.number().positive(),
  description: z.string().optional(),
});

export const UpdateShiftSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  rate: z.number().positive().optional(),
  description: z.string().optional(),
});

export type CreateShiftDto = z.infer<typeof CreateShiftSchema>;
export type UpdateShiftDto = z.infer<typeof UpdateShiftSchema>;