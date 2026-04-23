import { Module } from '@nestjs/common';
import { AdminService } from './service/admin.service';
import { AdminController } from './controller/admin.controller';
import { SharedService } from 'src/shared/services/shared.service';
import { EmailService } from '../inbox/service/email.service';
import { InboxModule } from '../inbox/inbox.module';

@Module({
    imports: [InboxModule],
    controllers: [AdminController],
    providers: [AdminService, SharedService, EmailService],
})
export class AdminModule {

}
