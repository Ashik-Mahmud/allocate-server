
// Write admin controller code
import { Request, response, Response } from 'express';
import { AdminService } from '../service/admin.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { BroadcastAnnouncementDto, UpdateSystemSettingsDto } from '../dto/admin.dto';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { ResponseUtil } from 'src/utils/responses';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Only allow users with the 'admin' role to access these endpoints
@Controller('admin')
export class AdminController {

    constructor(private adminService: AdminService) {
        this.adminService = adminService;
    }

    /**
     * Add endpoint to manage system settings
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */


    @Patch('/system-settings')
    @ApiResponse({ status: 200, description: 'System settings updated successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Update system settings' })
    async updateSystemSettings(@CurrentUser() user: User, @Body() updateSystemSettingsDto: UpdateSystemSettingsDto, @Res() response: Response) {
        // Implement logic to update system settings here
        // You can use this.adminService to call service methods for business logic
        const updatedSettings = await this.adminService.updateSystemSettings(user, updateSystemSettingsDto);
        ResponseUtil.success(updatedSettings, response);
    }

    /**
     * Get system settings endpoint for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/system-settings')
    @ApiResponse({ status: 200, description: 'System settings retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get system settings' })
    async getSystemSettings(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to retrieve system settings here
        // You can use this.adminService to call service methods for business logic
        const settings = await this.adminService.getSystemSettings(user);
        ResponseUtil.success(settings, response);
    }

    /**
     * Add endpoint to broadcast announcement to all organizations/users
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Post('/announcements')
    @ApiResponse({ status: 200, description: 'Announcement broadcasted successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Broadcast announcement' })
    async broadcastAnnouncement(@CurrentUser() user: User, @Body() broadcastAnnouncementDto: BroadcastAnnouncementDto, @Res() response: Response) {
        // Implement logic to broadcast announcement to all organizations/users here
        // You can use this.adminService to call service methods for business logic
        const result = await this.adminService.broadcastAnnouncement(user, broadcastAnnouncementDto);

        ResponseUtil.success(result, response);
    }


    /**
     *  Get all organizations with their verification status for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/organizations')
    @ApiResponse({ status: 200, description: 'Organizations retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get all organizations with verification status' })
    async getAllOrganizations(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to retrieve all organizations with their verification status here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Organizations retrieved successfully', data: [] });
    }

    /**
     * Get single organization details by ID for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/organizations/:orgId')
    @ApiParam({ name: 'orgId', description: 'ID of the organization to retrieve' })
    @ApiResponse({ status: 200, description: 'Organization details retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get organization details by ID' })
    async getOrganizationDetails(@CurrentUser() user: User, @Param('orgId') orgId: string, @Res() response: Response) {
        // Implement logic to retrieve organization details by ID here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Organization details retrieved successfully', data: {} });
    }

    /**
     * Add endpoint to change organization verification status
     * @param request - The incoming request object
     * @param response - The outgoing response object
     * This endpoint allows the admin to verify or unverify an organization
     */
    @Patch('/organizations/:orgId/verification')
    @ApiParam({ name: 'orgId', description: 'ID of the organization to update verification status' })
    @ApiResponse({ status: 200, description: 'Organization verification status updated successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Update organization verification status' })
    async updateOrganizationVerificationStatus(@CurrentUser() user: User, @Param('orgId') orgId: string, @Body() body: { verified: boolean }, @Res() response: Response) {
        // Implement logic to update organization verification status here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Organization verification status updated successfully' });
    }

    /**
     * Add endpoint to top up organization credits for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Patch('/organizations/:orgId/credits')
    @ApiParam({ name: 'orgId', description: 'ID of the organization to top up credits' })
    @ApiResponse({ status: 200, description: 'Organization credits topped up successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Top up organization credits' })
    async topUpOrganizationCredits(@CurrentUser() user: User, @Param('orgId') orgId: string, @Body() body: { credits: number }, @Res() response: Response) {
        // Implement logic to top up organization credits here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Organization credits topped up successfully' });
    }

    /**
     *  Get all users for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/users')
    @ApiResponse({ status: 200, description: 'Users retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get all users' })
    async getAllUsers(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to retrieve all users here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Users retrieved successfully', data: [] });
    }

    /**
     * User reset password endpoint for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     * This endpoint allows the admin to reset a user's password
     */
    @Patch('/users/:userId/reset-password')
    @ApiParam({ name: 'userId', description: 'ID of the user to reset password' })
    @ApiResponse({ status: 200, description: 'User password reset successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Reset user password' })
    async resetUserPassword(@CurrentUser() user: User, @Param('userId') userId: string, @Res() response: Response) {
        // Implement logic to reset user password here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'User password reset successfully' });
    }


    /**
     *  Get all subscription transaction history  for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/subscriptions/transactions')
    @ApiResponse({ status: 200, description: 'Subscription history retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get organization subscription transaction history' })
    async getOrganizationSubscriptionHistory(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to retrieve organization subscription transaction history here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Subscription history retrieved successfully', data: [] });
    }

    /**
     * Get all credit transaction history for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/credits/transactions')
    @ApiResponse({ status: 200, description: 'Credit transaction history retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get organization credit transaction history' })
    async getOrganizationCreditTransactionHistory(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to retrieve organization credit transaction history here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Credit transaction history retrieved successfully', data: [] });
    }

    /**
     * Get revenue analytics for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */
    @Get('/analytics/revenue')
    @ApiResponse({ status: 200, description: 'Revenue analytics retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get revenue analytics' })
    async getRevenueAnalytics(@CurrentUser() user: User, @Res() response: Response) {
        // Implement logic to retrieve revenue analytics here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'Revenue analytics retrieved successfully', data: {} });
    }

    /**
     * Get user activity logs for admin dashboard
     * @param request - The incoming request object
     * @param response - The outgoing response object
     * This endpoint allows the admin to retrieve user activity logs
     */
    @Get('/users/:userId/activity-logs')
    @ApiParam({ name: 'userId', description: 'ID of the user to retrieve activity logs' })
    @ApiResponse({ status: 200, description: 'User activity logs retrieved successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get user activity logs' })
    async getUserActivityLogs(@CurrentUser() user: User, @Param('userId') userId: string, @Res() response: Response) {
        // Implement logic to retrieve user activity logs here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'User activity logs retrieved successfully', data: [] });
    }



}
