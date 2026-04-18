import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ResponseUtil } from 'src/utils/responses';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto/organization.dto';
import { Response } from 'express';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';


@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(AuthGuard)
// Only clients can create organizations
@Controller('organization')
export class OrganizationController {

    constructor(private service: OrganizationService) { }

    /**
     * This controller will handle all organization related endpoints such as creating an organization, updating organization details, fetching organization information, etc.
     * @param organizationService - The service that will handle the business logic for organization related operations.
     * @param createOrganizationDto - The DTO that will be used to validate the data for creating an organization.
     * @return - A success response containing the organization information if the operation is successful.
     */


    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    @Post('create')
    @ApiQuery({ name: 'clientId', required: true, description: 'Select Organization Client' })
    @ApiOperation({ summary: 'Create a new organization (Admin only)' })
    @ApiResponse({ status: 201, description: 'Organization created successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async createOrganization(
        @Body() createOrganizationDto: CreateOrganizationDto,
        @Query('clientId') clientId: string,
        @Res() res: Response
    ) {
        // Logic to create an organization will go here
        const organization = await this.service.createOrganization(createOrganizationDto, clientId, res);
        return ResponseUtil.success(organization, res);
    }


    /**
     * This controller will handle all organization related endpoints such as creating an organization, updating organization details, fetching organization information, etc.
     * @param organizationService - The service that will handle the business logic for organization related operations.
     * @param updateOrganizationDto - The DTO that will be used to validate the data for updating an organization.
     * @return - A success response containing the updated organization information if the operation is successful.
     */

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.CLIENT)
    @Patch('profile/:id')
    @ApiQuery({ name: 'clientId', required: true, description: 'Select Organization Client' })
    @ApiOperation({ summary: 'Update organization details (Admin and Client)' })
    @ApiResponse({ status: 200, description: 'Organization updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin or Client role required' })
    async updateOrganization(
        @Param('id') id: string,
        @Body() updateOrganizationDto: UpdateOrganizationDto,
        @Query('clientId') clientId: string,
        @Res() res: Response
    ) {
        // Logic to update an organization will go here
        const organization = await this.service.updateOrganization(id, updateOrganizationDto, clientId, res);
        return ResponseUtil.success(organization, res);

    }

    // get organization details endpoint will go here
    /**
     * This controller will handle all organization related endpoints such as creating an organization, updating organization details, fetching organization information, etc.
     * @param organizationService - The service that will handle the business logic for organization related operations.
     * @return - A success response containing the organization information if the operation is successful.
     */

    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.CLIENT)
    @Get('profile/:id')
    @ApiOperation({ summary: 'Get organization details (Client)' })
    @ApiResponse({ status: 200, description: 'Organization details fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Client role required' })
    async getOrganization(@CurrentUser() currentUser: User, @Param('id') id: string,  clientId: string, @Res() res: Response) {
        // Logic to get an organization will go here
        const organization = await this.service.getOrganization(currentUser, id, res);
        return ResponseUtil.success(organization, res);
    }


}
