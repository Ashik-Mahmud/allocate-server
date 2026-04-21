

// Write admin controller code
import { Request, response, Response } from 'express';

import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { StaffService } from '../service/staff.service';
import { CreateStaffDto } from '../dto/staff.dto';
import { ResponseUtil } from 'src/utils/responses';


@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(AuthGuard, ClientGuard)
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

}
