import { Injectable, Logger } from '@nestjs/common';
import { CommunityHub, Notification, NotificationType, Role } from '@prisma/client';
import { CommunityRealtimeGateway } from './community-realtime.gateway';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { PrismaClient } from '@prisma/client/extension';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityRealtimeService {
    private readonly logger = new Logger(CommunityRealtimeService.name);

    constructor(
        private readonly communityRealtimeGateway: CommunityRealtimeGateway,
        private notificationManager: NotificationManager,
        private prisma: PrismaService
    ) { }


    // Send a real-time notification to all users in the organization when a new community post is created
    async sendBroadcastNotification(post: CommunityHub, user: CurrentUserType) {
        try {
            const viewPermission: any = post?.visibility;

            const targetRoles: Role[] = [];
            if (viewPermission?.showToAdmin) targetRoles.push(Role.ADMIN);
            if (viewPermission?.showToOrgAdmin) targetRoles.push(Role.ORG_ADMIN);
            if (viewPermission?.showToStaff) targetRoles.push(Role.STAFF);

            const roleCondition = targetRoles.length > 0 ? { role: { in: targetRoles } } : {};

            const recipientUsers = await this.prisma.user.findMany({
                where: {
                    org_id: user.org_id,
                    deletedAt: null,
                    ...roleCondition,
                },
                select: { id: true }
            });

            if (recipientUsers.length > 0) {
                await Promise.all(
                    recipientUsers.map(recipient =>
                        this.notificationManager.createNotification({
                            type: NotificationType.CREATE_COMMUNITY_POST,
                            title: 'New Post Published!',
                            message: `A new update titled "${post.title}" has been published in the Community Hub.`,
                            userId: recipient.id,
                            orgId: user.org_id,
                            metadata: { postId: post.id, triggeredBy: user.id }
                        }).catch(err => console.error(`Failed to notify user ${recipient.id}:`, err))
                    )
                );
            }
        } catch (error) {
            console.error(`Failed to create notification for updated community post "${post?.title}":`, error);
        }
    }


}
