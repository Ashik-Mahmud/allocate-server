import { Module } from '@nestjs/common';
import { InboxController } from './controller/inbox.controller';
import { InboxService } from './service/inbox.service';
import { EmailService } from './service/email.service';

@Module({
    controllers: [InboxController],
    providers: [InboxService, EmailService],
    exports: [EmailService],
})
export class InboxModule {}
