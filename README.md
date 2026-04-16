# Allowcate a Smart Resource-Sharing Hub for Co-working Spaces or Shared Offices

A modern, enterprise-grade backend API for managing employee shifts and payroll calculations built with NestJS, Prisma, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Shift Management**: Create, update, and track employee shifts
- **Payroll Calculation**: Automatic payroll computation based on hours worked and rates
- **User Management**: Admin and employee user roles
- **API Documentation**: Swagger/OpenAPI documentation
- **Type Safety**: Full TypeScript with Zod validation
- **Database**: PostgreSQL with Prisma ORM

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Zod
- **Documentation**: Swagger

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- pnpm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your database URL and JWT secret.

4. Set up the database:
   ```bash
   # Generate Prisma client
   pnpm prisma:generate

   # Run migrations
   pnpm prisma:migrate

   # Seed initial data
   pnpm db:seed
   ```

5. Start the development server:
   ```bash
   pnpm start:dev
   ```

The API will be available at `http://localhost:3000`
Swagger docs at `http://localhost:3000/api`

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh-token` - Refresh access token
- `GET /auth/profile` - Get user profile
- `POST /auth/change-password` - Change password

### Shifts
- `GET /shifts` - Get all user shifts
- `POST /shifts` - Create new shift
- `GET /shifts/:id` - Get specific shift
- `PATCH /shifts/:id` - Update shift
- `DELETE /shifts/:id` - Delete shift
- `POST /shifts/:id/payroll` - Calculate payroll for shift

## Project Structure

```
src/
├── config/           # Environment configuration
├── errors/           # Custom error classes
├── middleware/       # Global middleware
├── modules/          # Feature modules
│   ├── auth/         # Authentication module
│   └── shifts/       # Shifts management module
├── prisma/           # Database service
├── utils/            # Utility functions
└── app.module.ts     # Root module
```

## Scripts

- `pnpm start:dev` - Start development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio
- `pnpm db:seed` - Seed database

## Environment Variables

```env
DATABASE_URL="postgresql://username:password@localhost:5432/shift_payroll_db"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=3000
```

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
