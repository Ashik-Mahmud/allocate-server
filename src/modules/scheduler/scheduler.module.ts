import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports: [InboxModule],
  providers: [SchedulerService],
  controllers: [SchedulerController]
})
export class SchedulerModule {}
