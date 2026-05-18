import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { InboxModule } from '../inbox/inbox.module';
import { SharedService } from 'src/shared/services/shared.service';
import { CommunityRealtimeGateway } from './community-realtime.gateway';

@Module({
  imports: [InboxModule],
  providers: [CommunityService, CommunityRealtimeGateway, SharedService],
  controllers: [CommunityController]
})
export class CommunityModule {}
