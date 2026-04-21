import { Module } from '@nestjs/common';
import { AdminService } from './service/admin.service';
import { AdminController } from './controller/admin.controller';

@Module({
    imports: [],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {

}
