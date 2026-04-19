import { Module } from '@nestjs/common';
import { ResourcesController } from './controller/resources.controller';
import { ResourcesService } from './services/resources.service';
import { ResourcesRuleService } from './services/resources-rule.service';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourcesRuleService]
})
export class ResourcesModule {}
