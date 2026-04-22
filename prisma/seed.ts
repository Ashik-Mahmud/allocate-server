import { PaymentStatus, PlanType, PrismaClient, Role, User } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CryptoUtils } from '../src/modules/auth/utils/crypto';
import * as dotenv from 'dotenv';
import path from 'path';
import { uuid } from 'zod';

// Explicitly point to the .env file to be safe
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function main() {
  // Create admin user
  const hashedPassword = await CryptoUtils.hashPassword('Aa123456');


  const admin = await prisma.user.create({
    data: {
      email: 'ashikmahmud@admin.com',
      password: hashedPassword,
      name: 'Ashik Mahmud',
      role: Role.ADMIN,
      id: `ashik-187`,
      createdAt: new Date(),
      updatedAt: new Date(),
      last_login: new Date(),
      personal_credits: 0,
      is_verified: true,
      
    } as User
  });

  // Create system settings
  /*   maintenance_mode     Boolean  @default(false)
  global_alert_message Json?
  support_email        String?
  features_flags       Json? */
  const settings = await prisma.systemSettings.create({
    data: {
      id: 'default',
      support_email: 'ashikmahmud934@gmail.com',
      maintenance_mode: false,
      global_alert_message: {
        title: '',
        body: '',
        type: 'info',
        show: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        buttonText: '',
        buttonLink: '',
      },
      features_flags: {
        can_export_logs: false,
        ui_dark_mode: false,
      },
    },
  });

  console.log('Seed data created:', { admin, settings });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });