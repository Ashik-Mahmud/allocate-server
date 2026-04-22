import { Injectable } from "@nestjs/common";
import { NotificationType, Role, User } from "@prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { BroadcastAnnouncementDto, UpdateSystemSettingsDto } from "../dto/admin.dto";

// Write admin service code
@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) {
        // Initialize any necessary properties or dependencies here
    }

    // Get system settings
    async getSystemSettings(user: User) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: 'default' },
        });
        return settings;
    }

    // Update system settings
    async updateSystemSettings(user: User, data: UpdateSystemSettingsDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }
        const updated = await this.prisma.systemSettings.update({
            where: { id: 'default' },
            data,
        });
        return updated;
    }

    // Broadcast announcement to all organizations/users
    async broadcastAnnouncement(user: User, announcementData: BroadcastAnnouncementDto) {
        if (user.role !== Role.ADMIN) {
            throw new Error('Unauthorized');
        }

        const { title, message, userIds, type, metadata, receiverType } = announcementData;
        const targetRole =
            receiverType === 'ORG'
                ? Role.ORG_ADMIN
                : receiverType === 'STAFF'
                    ? Role.STAFF
                    : undefined;

        const users = await this.prisma.user.findMany({
            where: {
                ...(userIds && userIds.length > 0 ? { id: { in: userIds } } : {}),
                ...(targetRole ? { role: targetRole } : {}),
                deletedAt: null,
            },
            select: {
                id: true,
                org_id: true,
            },
        });

        if (users.length === 0) {
            return { count: 0, message: 'No users matched the announcement target' };
        }

        const notificationType = type || NotificationType.SYSTEM_ALERT;
        const announcementRows = users
            .filter((targetUser) => Boolean(targetUser.org_id))
            .map((targetUser) => ({
                user_id: targetUser.id,
                org_id: targetUser.org_id as string,
                type: notificationType,
                title,
                message,
                reference_id: null,
                metadata: {
                    ...(metadata || {}),
                    receiverType,
                    broadcastBy: user.id,
                    broadcastRole: user.role,
                },
            }));

        if (announcementRows.length === 0) {
            return { count: 0, message: 'No valid organization users were found for broadcast' };
        }

        const result = await this.prisma.notification.createMany({
            data: announcementRows,
        });

        return {
            count: result.count,
            message: 'Announcement broadcasted successfully',
            targetUsers: announcementRows.length,
        };
    }


}