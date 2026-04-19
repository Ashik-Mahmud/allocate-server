import { PaymentStatus, PlanType, PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CryptoUtils } from '../src/modules/auth/utils/crypto';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly point to the .env file to be safe
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function main() {
  // Create admin user
  const hashedPassword = await CryptoUtils.hashPassword('Aa123456');

  const admin = await prisma.$transaction(async (prisma) => {

    return prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        role: Role.ADMIN,
        id: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        last_login: new Date(),
        personal_credits: 0
      } as any
    });
  });

  // Create sample user
  const userPassword = await CryptoUtils.hashPassword('Aa123456');

  const user = await prisma.$transaction(async (prisma) => {
    const organization = await prisma.organizations.create({
      data: { name: 'Sample Organization', plan_type: PlanType.FREE },
    });


    const user = await prisma.user.create({
      data: {
        email: 'user@example.com',
        password: userPassword,
        name: 'John Doe',
        role: Role.ORG_ADMIN,
        org_id: organization.id,
        id: '2',
        createdAt: new Date(),
        updatedAt: new Date(),
        last_login: new Date(),
        personal_credits: 0
      } as any
    });

    await prisma.subscription.create({
      data: {
        org_id: organization.id,
        plan_name: PlanType.FREE,
        start_date: new Date(),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        payment_status: PaymentStatus.COMPLETED,
      },
    });

    return user;
  });

  console.log('Seed data created:', { admin, user });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });