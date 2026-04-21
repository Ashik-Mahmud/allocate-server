import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ca } from 'zod/v4/locales';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { StaffModule } from './modules/staff/staff.module';
import { AdminModule } from './modules/admin/admin.module';
import { InboxModule } from './modules/inbox/inbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    ResourcesModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    OrganizationModule,
    BookingsModule,
    StaffModule,
    AdminModule,
    InboxModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },

  ],
})
export class AppModule {

  // console log to check if the module is loaded
  constructor() {

  }


}
