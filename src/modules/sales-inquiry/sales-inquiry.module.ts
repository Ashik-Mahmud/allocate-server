import { Module } from '@nestjs/common';
import { SalesInquiryService } from './sales-inquiry.service';
import { SalesInquiryController } from './sales-inquiry.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from '../inbox/service/email.service';

@Module({
  imports: [PrismaModule],
  providers: [SalesInquiryService, EmailService],
  controllers: [SalesInquiryController],
})
export class SalesInquiryModule { }
