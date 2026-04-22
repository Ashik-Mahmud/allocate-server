import { Module } from '@nestjs/common';
import { ResourcesController } from './controller/resources.controller';
import { ResourcesService } from './services/resources.service';
import { ResourcesRuleService } from './services/resources-rule.service';
import { SharedService } from 'src/shared/services/shared.service';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourcesRuleService, SharedService]
})
export class ResourcesModule {}
