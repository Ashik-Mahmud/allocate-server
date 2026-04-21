

// Write admin controller code
import { Request, response, Response } from 'express';

import { ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard, UserVerificationGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { StaffService } from '../service/staff.service';
import { CreateStaffDto, UpdateStaffDto } from '../dto/staff.dto';
import { ResponseUtil } from 'src/utils/responses';
import { StaffFilterDto } from '../dto/staff-filter.dto';


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
    @ApiResponse({ status: 201, description: 'Staff member created successfully.' })
    @ApiResponse({ status: 400, description: 'Bad Request.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async create(@Body() createStaffDto: CreateStaffDto, @CurrentUser() user: User) {
        const staff = await this.staffService.createStaff(createStaffDto, user);
        return ResponseUtil.success(staff);
    }



    /**
     * Get all staff members in the organization
     * @param user - The current authenticated user
     * @return A list of staff members
     */
    @Get("list")
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
    async getStaffById(@Query('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
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
    async updateStaff(@Query('id') id: string, @Body() updateStaffDto: UpdateStaffDto, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to update a staff member's information
        const staff = await this.staffService.updateStaff(id, updateStaffDto, user);
        return ResponseUtil.success(staff, res);
    }


    /**
     * Delete a staff member
     * @param id - The ID of the staff member to delete
     * @param user - The current authenticated user
     * @returns The deleted staff member
     */

     @Patch(":id/delete")
     @ApiParam({ name: 'id', description: 'The ID of the staff member to delete', type: String })
     @ApiResponse({ status: 200, description: 'Staff member deleted successfully.' })
     @ApiResponse({ status: 401, description: 'Unauthorized.' })
     @ApiResponse({ status: 403, description: 'Forbidden.' })
    async deleteStaff(@Query('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
        // Implement logic to delete a staff member
        const staff = await this.staffService.deleteStaff(id, user);
        return ResponseUtil.success(staff, res);
    }
     

}
