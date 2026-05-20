import { Module } from '@nestjs/common';
import { SharedService } from 'src/shared/services/shared.service';
import { InboxModule } from '../inbox/inbox.module';
import { ResourcesController } from './controller/resources.controller';
import { ResourcesRuleService } from './services/resources-rule.service';
import { ResourcesService } from './services/resources.service';

@Module({
  controllers: [ResourcesController],
  imports: [InboxModule],
  providers: [ResourcesService, ResourcesRuleService, SharedService],
})
export class ResourcesModule {}
