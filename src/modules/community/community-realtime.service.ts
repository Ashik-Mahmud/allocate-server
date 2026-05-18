import { Injectable, Logger } from '@nestjs/common';
import { CommunityHub, Notification, NotificationType, Role } from '@prisma/client';
import { CommunityRealtimeGateway } from './community-realtime.gateway';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { PrismaClient } from '@prisma/client/extension';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationRealtimeGateway } from '../inbox/service/notification-realtime.gateway';

@Injectable()
export class CommunityRealtimeService {
    private readonly logger = new Logger(CommunityRealtimeService.name);

    constructor(
        private readonly communityRealtimeGateway: CommunityRealtimeGateway,
        private notificationManager: NotificationManager,
        private prisma: PrismaService,
        private notificationGateway: NotificationRealtimeGateway
    ) { }


    emitCommunityPostCreated(orgId: string, post: CommunityHub) {
        try {
            this.communityRealtimeGateway.emitCommunityPostCreated(
                orgId,
                post,
            );
        } catch (error) {
            this.logger.error(
                `Failed to emit real-time notification for user ${orgId} about new community post "${post?.title}":`,
                error instanceof Error ? error.stack : undefined,
            );
        }
    }

    // Send a real-time notification to all users in the organization when a new community post is created
    // async sendBroadcastNotification(post: CommunityHub, user: CurrentUserType) {
    //     try {
    //         const viewPermission: any = post?.visibility;

    //         const targetRoles: Role[] = [];
    //         if (viewPermission?.showToAdmin) targetRoles.push(Role.ADMIN);
    //         if (viewPermission?.showToOrgAdmin) targetRoles.push(Role.ORG_ADMIN);
    //         if (viewPermission?.showToStaff) targetRoles.push(Role.STAFF);

    //         const roleCondition = targetRoles.length > 0 ? { role: { in: targetRoles } } : {};

    //         const recipientUsers = await this.prisma.user.findMany({
    //             where: {
    //                 org_id: user.org_id,
    //                 deletedAt: null,
    //                 ...roleCondition,
    //             },
    //             select: { id: true }
    //         });

    //         if (recipientUsers.length > 0) {
    //             await Promise.all(
    //                 recipientUsers.map(recipient =>
    //                     this.notificationManager.createNotification({
    //                         type: NotificationType.CREATE_COMMUNITY_POST,
    //                         title: 'New Post Published!',
    //                         message: `A new update titled "${post.title}" has been published in the Community Hub.`,
    //                         userId: recipient.id,
    //                         orgId: user.org_id,
    //                         metadata: { postId: post.id, triggeredBy: user.id }
    //                     }).catch(err => console.error(`Failed to notify user ${recipient.id}:`, err))
    //                 )
    //             );
    //         }
    //     } catch (error) {
    //         console.error(`Failed to create notification for updated community post "${post?.title}":`, error);
    //     }
    // }

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

            if (!recipientUsers || recipientUsers.length === 0) return;

            const notificationTitle = 'New Post Published!';
            const notificationMessage = `A new update titled "${post.title}" has been published in the Community Hub.`;
            const metadataJson = { postId: post.id, triggeredBy: user.id };

            const notificationData = recipientUsers.map(recipient => ({
                id: crypto.randomUUID(),
                type: NotificationType.CREATE_COMMUNITY_POST,
                title: notificationTitle,
                message: notificationMessage,
                user_id: recipient.id,
                org_id: user.org_id,
                metadata: metadataJson,
                createdAt: new Date(),

            }));

            await this.prisma.notification.createMany({
                data: notificationData,
            });


            if (this.communityRealtimeGateway && typeof this.communityRealtimeGateway.emitCommunityPostCreatedNotification === 'function') {
                this.communityRealtimeGateway.emitCommunityPostCreatedNotification(user.org_id, {
                    type: NotificationType.CREATE_COMMUNITY_POST,
                    title: notificationTitle,
                    message: notificationMessage,
                    metadata: metadataJson,
                    createdAt: new Date(),
                    idMap: notificationData.map(n => ({ id: n.id, userId: n.user_id }))
                });
            }

        } catch (error) {
            console.error(`Failed to create notification for updated community post "${post?.title}":`, error);
        }
    }

}
