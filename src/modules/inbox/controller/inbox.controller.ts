
// Write admin controller code
import { Request, response, Response } from 'express';

import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { InboxService } from '../service/inbox.service';

@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('inbox')
export class InboxController {

    constructor(private inboxService: InboxService) { }


    /**
     * Get inbox messages for the authenticated user
     * @param user - The currently authenticated user
     * @param response - The outgoing response object
     */

    @Get('/notifications')
    @ApiResponse({ status: 200, description: 'Inbox messages retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get Inbox Messages', description: 'Retrieve inbox messages for the authenticated user.' })
    async getInboxMessages(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to get inbox messages for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        const messages = await this.inboxService.getInboxMessages(user.id);
        response.status(200).json(messages);
    }


    /**
     * Add endpoint to read a specific notification
     * @param user - The currently authenticated user
     * @param notificationId - The ID of the notification to mark as read
     */
    @Patch('/notifications/:id/read')
    @ApiResponse({ status: 200, description: 'Notification marked as read successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Mark Notification as Read', description: 'Mark a specific notification as read for the authenticated user.' })
    @ApiParam({ name: 'id', description: 'The ID of the notification to mark as read', type: 'string' })
    async markNotificationAsRead(@CurrentUser() user: User, @Param('id') notificationId: string, @Res() response: Response) {
        // Implement logic to mark a specific notification as read for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        response.status(200).json({ message: 'Notification marked as read successfully' });
    }


    /**
     * Add endpoint to mark all notifications as read
     * @param user - The currently authenticated user
     * @param response - The outgoing response object
     */
    @Patch('/notifications/read-all')
    @ApiResponse({ status: 200, description: 'All notifications marked as read successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Mark All Notifications as Read', description: 'Mark all notifications as read for the authenticated user.' })
    async markAllNotificationsAsRead(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to mark all notifications as read for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        response.status(200).json({ message: 'All notifications marked as read successfully' });
    }


    /**
     * Add endpoint to delete a specific notification
     * @param user - The currently authenticated user
     * @param notificationId - The ID of the notification to delete
     */
    @Delete('/notifications/:id/delete')
    @ApiResponse({ status: 200, description: 'Notification deleted successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Delete Notification', description: 'Delete a specific notification for the authenticated user.' })
    @ApiParam({ name: 'id', description: 'The ID of the notification to delete', type: 'string' })
    async deleteNotification(@CurrentUser() user: User, @Param('id') notificationId: string, @Res() response: Response) {
        // Implement logic to delete a specific notification for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        response.status(200).json({ message: 'Notification deleted successfully' });
    }

    /**
     * Add endpoint to clear all notifications for the authenticated user
     * @param user - The currently authenticated user
     * @param response - The outgoing response object
     */
    @Delete('/notifications/clear')
    @ApiResponse({ status: 200, description: 'All notifications cleared successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Clear All Notifications', description: 'Clear all notifications for the authenticated user.' })
    async clearAllNotifications(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to clear all notifications for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        response.status(200).json({ message: 'All notifications cleared successfully' });
    }



}
