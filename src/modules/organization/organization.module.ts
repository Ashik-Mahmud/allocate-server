import { Module } from '@nestjs/common';
import { OrganizationController } from './controller/organization.controller';
import { OrganizationService } from './services/organization.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService]
})
export class OrganizationModule {}
