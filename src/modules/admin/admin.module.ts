import { Module } from '@nestjs/common';
import { AdminService } from './service/admin.service';
import { AdminController } from './controller/admin.controller';
import { SharedService } from 'src/shared/services/shared.service';
import { EmailService } from '../inbox/service/email.service';
import { InboxModule } from '../inbox/inbox.module';
import { InboxService } from '../inbox/service/inbox.service';
import { NotificationRealtimeService } from '../inbox/service/notification-realtime.service';

@Module({
    imports: [InboxModule],
    controllers: [AdminController],
    providers: [AdminService, SharedService, EmailService],
})
export class AdminModule {

}
