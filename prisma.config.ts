import * as dotenv from 'dotenv';

// Manually load the .env file
dotenv.config();

// If the 'prisma' import fails, you can export a plain object
export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};