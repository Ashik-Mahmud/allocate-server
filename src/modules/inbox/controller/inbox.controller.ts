
// Write admin controller code
import { Request, response, Response } from 'express';

import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { InboxService } from '../service/inbox.service';
import { NotificationManager } from '../service/notification-manager.service';
import { ResponseUtil } from 'src/utils/responses';

@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('inbox')
export class InboxController {

    constructor(private inboxService: InboxService, private notificationManager: NotificationManager) { }


    /**
     * Get inbox messages for the authenticated user
     * @param user - The currently authenticated user
     * @param response - The outgoing response object
     */

    @Get('/notifications')
    @ApiResponse({ status: 200, description: 'Inbox messages retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page' })
    @ApiQuery({ name: 'is_read', required: false, type: String, description: 'Filter notifications by read status' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term to filter notifications by title or message' })
    @ApiOperation({ summary: 'Get Inbox Messages', description: 'Retrieve inbox messages for the authenticated user.' })
    async getInboxMessages(@CurrentUser() user: User, @Res() response: Response, @Query() query: { page?: number; limit?: number; is_read?: string; search?: string }) {
        // Implement logic to get inbox messages for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        // const messages = await this.inboxService.getInboxMessages(user.id);
        // response.status(200).json(messages);
        const result = await this.notificationManager.getInboxMessages(user.id, query);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, response);
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
        const result = await this.notificationManager.markAsRead(user.id, notificationId);
        return ResponseUtil.success(result, response);
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
        const result = await this.notificationManager.markAllAsRead(user.id);
        return ResponseUtil.success(result, response);
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
        const result = await this.notificationManager.deleteNotification(user.id, notificationId);
        return ResponseUtil.success(result, response);

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
        const result = await this.notificationManager.deleteAllNotifications(user.id);
        return ResponseUtil.success(result, response);
    }

    /**
     * Add endpoint to get unread notifications count for the authenticated user
     * @param user - The currently authenticated user
     * @param response - The outgoing response object
     */
    @Get('/notifications/unread-count')
    @ApiResponse({ status: 200, description: 'Unread notifications count retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get Unread Notifications Count', description: 'Retrieve the count of unread notifications for the authenticated user.' })
    async getUnreadNotificationsCount(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to get the count of unread notifications for the authenticated user here
        // You can use this.inboxService to call service methods for business logic
        const result = await this.notificationManager.getUnreadCount(user.id);
        return ResponseUtil.success({ unreadCount: result }, response);
    }




}
