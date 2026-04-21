import { Module } from '@nestjs/common';
import { InboxController } from './controller/inbox.controller';
import { InboxService } from './service/inbox.service';

@Module({
    controllers: [InboxController],
    providers: [InboxService],
    exports: [],
})
export class InboxModule {}
