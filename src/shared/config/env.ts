import { config } from 'dotenv';
import { z } from 'zod';
import * as path from 'path';
// Load environment variables from .env file
const environment = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `.env.${environment}`);
config({
  path: envPath
});

console.log(`🌱 Environment loaded: .env.${environment}`);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  RESET_PASSWORD_TOKEN_ENPIRES_IN: z.string().default('2m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BREVO_API_KEY: z.string(),
  SENDER_EMAIL: z.string().email(),
  SENDER_NAME: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  WEB_APP_LINK: z.string().url(),
  BACKEND_URL: z.string().url(),

  SSL_STORE_ID: z.string(),
  SSL_STORE_PASSWORD: z.string(),
  SSL_API_URL: z.string().url(),


});

export const env = envSchema.parse(process.env);