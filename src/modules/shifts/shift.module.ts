import { Module } from '@nestjs/common';
import { ShiftController } from './controllers/shift.controller';
import { ShiftService } from './services/shift.service';

@Module({
  controllers: [ShiftController],
  providers: [ShiftService],
  exports: [ShiftService],
})
export class ShiftModule {}