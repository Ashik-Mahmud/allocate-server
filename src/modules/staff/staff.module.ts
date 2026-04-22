import { Module } from '@nestjs/common';
import { StaffController } from './controller/staff.controller';
import { StaffService } from './service/staff.service';
import { EmailService } from '../inbox/service/email.service';
import { InboxModule } from '../inbox/inbox.module';
import { SharedService } from 'src/shared/services/shared.service';

@Module({
    imports: [InboxModule],
    controllers: [StaffController],
    providers: [StaffService, EmailService,SharedService ],
    exports: [],
})
export class StaffModule { }
