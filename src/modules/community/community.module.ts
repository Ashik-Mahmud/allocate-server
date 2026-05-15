import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { CommunityGateway } from './community.gateway';
import { InboxModule } from '../inbox/inbox.module';
import { SharedService } from 'src/shared/services/shared.service';

@Module({
  imports: [InboxModule],
  providers: [CommunityService, CommunityGateway, SharedService],
  controllers: [CommunityController]
})
export class CommunityModule {}
