import { PrismaClient } from '@prisma/client';
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
  const hashedPassword = await CryptoUtils.hashPassword('Admin123!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      id: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      last_login: new Date(),
      personal_credits: 0,
      
    } as any,
  });

  // Create sample user
  const userPassword = await CryptoUtils.hashPassword('User123!');

  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
     create: {
       email: 'user@example.com',
       password: userPassword,
       name: 'John Doe',
       role: 'CLIENT ',
       id: '2',
       createdAt: new Date(),
       updatedAt: new Date(),
       last_login: new Date(),
       personal_credits: 0
     } as any
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