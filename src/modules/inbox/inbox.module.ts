import { Module } from '@nestjs/common';
import { InboxController } from './controller/inbox.controller';
import { InboxService } from './service/inbox.service';
import { EmailService } from './service/email.service';
import { NotificationManager } from './service/notification-manager.service';
import { SharedService } from 'src/shared/services/shared.service';
import { NotificationRealtimeGateway } from './service/notification-realtime.gateway';
import { NotificationRealtimeService } from './service/notification-realtime.service';

@Module({
    controllers: [InboxController],
    providers: [
        InboxService,
        EmailService,
        NotificationManager,
        SharedService,
        NotificationRealtimeGateway,
        NotificationRealtimeService,
    ],
    exports: [EmailService, NotificationManager, InboxService, NotificationRealtimeService],
})
export class InboxModule {}
