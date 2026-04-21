import { Module } from '@nestjs/common';
import { StaffController } from './controller/staff.controller';
import { StaffService } from './service/staff.service';

@Module({
    controllers: [StaffController],
    providers: [StaffService],
    exports: [],
})
export class StaffModule { }
