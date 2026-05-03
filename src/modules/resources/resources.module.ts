import { Module } from '@nestjs/common';
import { ResourcesController } from './controller/resources.controller';
import { ResourcesService } from './services/resources.service';
import { ResourcesRuleService } from './services/resources-rule.service';
import { SharedService } from 'src/shared/services/shared.service';
import { InboxService } from '../inbox/service/inbox.service';
import { InboxModule } from '../inbox/inbox.module';

@Module({
  controllers: [ResourcesController],
  imports: [InboxModule],
  providers: [ResourcesService, ResourcesRuleService, SharedService]
})
export class ResourcesModule {}
