import { Module } from '@nestjs/common';
import { InboxController } from './controller/inbox.controller';
import { InboxService } from './service/inbox.service';
import { EmailService } from './service/email.service';
import { NotificationManager } from './service/notification-manager.service';

@Module({
    controllers: [InboxController],
    providers: [InboxService, EmailService, NotificationManager],
    exports: [EmailService, NotificationManager],
})
export class InboxModule {}
