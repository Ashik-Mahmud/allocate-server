import { Module } from '@nestjs/common';
import { BookingsService } from './services/bookings.service';
import { BookingsController } from './controller/bookings.controller';
import { InboxModule } from '../inbox/inbox.module';
import { BookingUtilService } from './services/bookingUtil.service';

@Module({
  imports: [InboxModule],
  controllers: [BookingsController],
  providers: [BookingsService,BookingUtilService]
})
export class BookingsModule { }
