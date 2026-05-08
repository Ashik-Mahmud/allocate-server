import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SharedService } from 'src/shared/services/shared.service';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  imports:[InboxModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SharedService]
})
export class PaymentsModule {}
