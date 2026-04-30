import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { EmailService } from "./email.service";
import { NotificationType } from "@prisma/client";

// Write inbox service code
@Injectable()
export class InboxService {
    constructor(private prisma: PrismaService, private emailService: EmailService) {
        // Initialize any necessary properties or dependencies here
    }
    // create notification for user
    async createNotification(data: {
        userId: string;
        orgId: string;
        type: NotificationType;
        title: string;
        message: string;
        refId?: string;
    }) {
        const notification = await this.prisma.notification.create({
            data: {
                user_id: data.userId,
                org_id: data.orgId,
                type: data.type,
                title: data.title,
                message: data.message,
                reference_id: data.refId,
            },
        });
 
        // this.socketService.sendToUser(data.userId, notification);

        return notification;
    }

    // Method to get inbox messages for a user
    async getInboxMessages(userId: string) {
        // Implement logic to retrieve inbox messages for the user from the database
        // You can use PrismaService to query the database and return the messages
        return await this.prisma.notification.findMany({
            where: {
                user_id: userId,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}