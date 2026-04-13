import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ShiftModule } from './modules/shifts/shift.module';
import { ClipboardShift } from './modules/shifts/types/shift.types';
import { ca } from 'zod/v4/locales';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    ShiftModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {

  // console log to check if the module is loaded
  constructor() {
    console.log('AppModule loaded');
    this.fetchShiftData();
  }

  shiftData: ClipboardShift[] = [];

  async fetchShiftData() {
    try {
      const shiftData = await this.fetchShiftDataService();
      this.shiftData = shiftData;

      /// call this function to count the completed shifts and log the result
      console.log('Number of completed shifts:', this.countCompletedShifts());

      // call this function to calculate the total shift time and log the result
      console.log('Total shift time (hours):', this.calculateTotalShiftTime());

      // call this function to calculate the overtime hours with hourly rate which is 1.5 of the regular rate if the shift duration is more than 8 hours and log the result
      console.log('Overtime hours and rates:', this.calculateOverTimeHours());
    } catch (error) {
      console.error('Error fetching shift data:', error);
      return;
    }
  }


  // fetch shift data from the external API 
  async fetchShiftDataService() {
    const response = await fetch('https://mocki.io/v1/9072950b-34af-4cf0-a8f9-84672cd3187c');
    if (!response.ok) {
      throw new Error('Failed to fetch shift data');
    }
    const data = await response.json();
    return data as ClipboardShift[];
  }

  // Count only the completed shifts
  countCompletedShifts(): number {
    return this.shiftData.filter(shift => shift.status === 'COMPLETED').length;
  };

  // sum the total time of the each shift and return the total time
  calculateTotalShiftTime(): number {
    return this.shiftData.filter(shift => shift.status === 'COMPLETED').reduce((total, shift) => {
      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      const shiftDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // convert to hours
      return total + shiftDuration;
    }, 0);
  }

  // count the over time hours for each shift and return the array with the shift id and extra overtime they did and also log the hourly rate for extra overtime which will be the 1.5x of hourlyRate
  calculateOverTimeHours(): { shiftId: string; overtimeHours: number; overtimeRate: number }[] {
    return this.shiftData.filter(shift => shift.status === 'COMPLETED').map(shift => {
      const startTime = new Date(shift.startTime);
      const endTime = new Date(shift.endTime);
      const shiftDuration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60); // convert to hours
      const overtimeHours = Math.max(0, shiftDuration - 8); //  8 hours is the regular shift duration
      const overtimeRate = shift.hourlyRate * 1.5; //  1.5x rate for overtime

      return {
        shiftId: shift.id,
        workerId: shift.workerId,
        hourlyRate: shift.hourlyRate,
        overtimeHours,
        overtimeRate,
      }
    })
  }

}
