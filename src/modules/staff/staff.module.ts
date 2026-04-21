import { Module } from '@nestjs/common';
import { StaffController } from './controller/staff.controller';
import { StaffService } from './service/staff.service';
import { EmailService } from '../inbox/service/email.service';

@Module({
    controllers: [StaffController],
    providers: [StaffService, EmailService],
    exports: [],
})
export class StaffModule { }
