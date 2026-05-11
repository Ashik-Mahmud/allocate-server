import { Module } from '@nestjs/common';
import { SalesInquiryService } from './sales-inquiry.service';
import { SalesInquiryController } from './sales-inquiry.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from '../inbox/service/email.service';
import { InboxService } from '../inbox/service/inbox.service';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [PrismaModule, InboxModule],
  providers: [SalesInquiryService, EmailService, ],
  controllers: [SalesInquiryController],
})
export class SalesInquiryModule { }
