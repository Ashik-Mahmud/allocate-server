import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingsController } from './controller/bookings.controller';
import { InboxModule } from '../inbox/inbox.module';
import { BookingUtilService } from './services/bookingUtil.service';
import { SharedService } from 'src/shared/services/shared.service';

@Module({
  imports: [InboxModule],
  controllers: [BookingsController],
  providers: [BookingsService,BookingUtilService, SharedService]
})
export class BookingsModule { }
