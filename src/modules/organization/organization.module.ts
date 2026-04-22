import { Module } from '@nestjs/common';
import { OrganizationController } from './controller/organization.controller';
import { OrganizationService } from './services/organization.service';
import { SharedService } from 'src/shared/services/shared.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, SharedService]
})
export class OrganizationModule {}
