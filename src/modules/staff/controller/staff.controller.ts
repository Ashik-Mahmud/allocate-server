

// Write admin controller code
import { Request, response, Response } from 'express';

import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard, SubscriptionGuard, UserVerificationGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { PlanType, Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { StaffService } from '../service/staff.service';
import { CreateStaffDto, ManageCreditsDto, ManageMultipleStaffCreditsDto, UpdateStaffDto } from '../dto/staff.dto';
import { ResponseUtil } from 'src/utils/responses';
import { CreditLogsFilterDto, StaffFilterDto } from '../dto/staff-filter.dto';
import { SubscriptionPlans } from 'src/shared/decorators/subscription.decorator';


@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(AuthGuard, ClientGuard, UserVerificationGuard)
@Controller('staff')
export class StaffController {

    constructor(private staffService: StaffService) { }


    /**
     * Create a new staff member
     * @param createStaffDto - The data for creating a staff member
     * @param user - The current authenticated user
     */

    @Post("create")
    @ApiOperation({ summary: 'Create a new staff member in the organization (Organization Admin Only)' })
    @ApiResponse({ status: 201, description: 'Staff member created successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() createStaffDto: CreateStaffDto, @CurrentUser() user: User, @Res({ passthrough: true }) response: Response) {
        const staff = await this.staffService.createStaff(createStaffDto, user, response);
        return ResponseUtil.success(staff, response);
    }



    /**
     * Get all staff members in the organization
     * @param user - The current authenticated user
     * @return A list of staff members
     */
    @Get("list")
    @ApiOperation({ summary: 'Get all staff members in the organization (Organization Admin Only)' })
    @ApiResponse({ status: 200, description: 'List of staff members retrieved successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'email', required: false, type: String })
    @ApiQuery({ name: 'org_id', required: false, type: String })
    async getAllStaff(@CurrentUser() user: User, @Query() query: StaffFilterDto, @Res() res: Response) {
        const result = await this.staffService.getStaffMembersList(user, query);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, res);
    }



    /**
     * Get a specific staff member by ID
     * @param id - The ID of the staff member to retrieve
     */
    @Get(":id")
    @ApiParam({ name: 'id', description: 'The ID of the staff member to retrieve', type: String })
    @ApiResponse({ status: 200, description: 'Staff member retrieved successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get a specific staff member by ID (Organization Admin Only)' })
    async getStaffById(@Param('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to retrieve a staff member by ID
        const staff = await this.staffService.getStaffById(id, user);
        return ResponseUtil.success(staff || null, res);
    }


    /**
     * Update a staff member's information
     * @param id - The ID of the staff member to update
     * @param updateStaffDto - The data for updating the staff member
     */
    @Patch(":id")
    @ApiParam({ name: 'id', description: 'The ID of the staff member to update', type: String })
    @ApiResponse({ status: 200, description: 'Staff member updated successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Update a staff member\'s information (Organization Admin Only)' })
    async updateStaff(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to update a staff member's information
        const staff = await this.staffService.updateStaff(id, updateStaffDto, user, res);
        return ResponseUtil.success(staff, res);
    }


    /**
     * Delete a staff member
     * @param id - The ID of the staff member to delete
     * @param user - The current authenticated user
     * @returns The deleted staff member
     */

    @Delete(":id/delete")
    @ApiParam({ name: 'id', description: 'The ID of the staff member to delete', type: String })
    @ApiResponse({ status: 200, description: 'Staff member deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Delete a staff member (Organization Admin Only)' })

    async deleteStaff(@Param('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to delete a staff member
        const staff = await this.staffService.deleteStaff(id, user, res);
        return ResponseUtil.success(staff, res);
    }


    /**
     *  Manage/Assign credits to a staff member 
     * @route POST /staff/:id/credits
     * @param id - The ID of the staff member to manage credits for
     * @param manageCreditsDto - The data for managing credits
     */

    @Post(":id/credits")
    @ApiParam({ name: 'id', description: 'The ID of the staff member to manage credits for', type: String })
    @ApiBody({ type: ManageCreditsDto })
    @ApiResponse({ status: 200, description: 'Staff member credits managed successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Manage/Assign credits to a staff member (Organization Admin Only)' })
    async manageCredits(@Param('id') id: string, @Body() manageCreditsDto: ManageCreditsDto, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to manage/assign credits to a staff member
        // This is a placeholder implementation and should be replaced with actual logic
        const result = await this.staffService.manageSingleStaffCredits(id, manageCreditsDto, user, res);
        return ResponseUtil.success({ message: `Credits for staff member ${id} managed successfully` }, res);
    }


    /**
     * Manage/Assign credits to multiple staff members
     * @route POST /staff/credits
     * @param manageCreditsDto - The data for managing credits for multiple staff members
     */

    @Post("credits")
    @ApiBody({ type: ManageMultipleStaffCreditsDto })
    @ApiResponse({ status: 200, description: 'Staff members credits managed successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Manage/Assign credits to multiple staff members (Organization Admin Only)' })
    async manageMultipleStaffCredits(@Body() manageCreditsDto: ManageMultipleStaffCreditsDto, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to manage/assign credits to multiple staff members
        // This is a placeholder implementation and should be replaced with actual logic
        const result = await this.staffService.manageMultipleStaffCredits(manageCreditsDto, user, res);
        return ResponseUtil.success({ message: `Credits for staff members managed successfully` }, res);
    }


    /**
     * Revoke credits from a staff member (This can be implemented as part of manageSingleStaffCredits by passing negative credits, but we can also have a separate endpoint for clarity)
     * @route POST /staff/:id/credits/revoke
     * @param id - The ID of the staff member to revoke credits from
     * @param manageCreditsDto - The data for revoking credits
     */
    @Post(":id/credits/revoke")
    @ApiParam({ name: 'id', description: 'The ID of the staff member to revoke credits from', type: String })
    @ApiBody({ type: ManageCreditsDto })
    @ApiResponse({ status: 200, description: 'Staff member credits revoked successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Revoke credits from a staff member (Organization Admin Only)' })
    async revokeCredits(@Param('id') id: string, @Body() manageCreditsDto: ManageCreditsDto, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to revoke credits from a staff member
        // This is a placeholder implementation and should be replaced with actual logic
        const result = await this.staffService.revokeStaffCredits(id, manageCreditsDto, user, res);
        return ResponseUtil.success({ message: `Credits for staff member ${id} revoked successfully` }, res);
    }

    /**
     * Get api to see the staff credit logs history (credits assigned, credits used, credits expired etc)
     * @route GET /staff/credits/logs
     * @param user - The current authenticated user
     * @returns The staff credit logs history
     */

    @Get("credits/logs")
    @UseGuards(SubscriptionGuard)
    @SubscriptionPlans(PlanType.PRO, PlanType.ENTERPRISE)
    @ApiResponse({ status: 200, description: 'Staff credit logs history retrieved successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    @ApiOperation({ summary: 'Get the staff credit logs history (Organization Admin Only)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({name: 'search', required: false, type: String, description: 'Search by resource name or action type'})
    async getStaffCreditLogs(@CurrentUser() user: User, @Res() res: Response, @Query() query: CreditLogsFilterDto) {
        // Implement logic to get the staff credit logs history
        const report = await this.staffService.getStaffCreditLogs(user, query, res);
        return ResponseUtil.success(report, res);
    }

}
