import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ResponseUtil } from 'src/utils/responses';
import { CreateResourceDto, UpdateResourceDto, } from '../dto/resources.dto';
import { Response } from 'express';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { ResourcesService } from '../services/resources.service';


@ApiTags('Resources')
@ApiBearerAuth()
@UseGuards(AuthGuard)
// Only clients can create organizations
@Controller('resources')
export class ResourcesController {

    constructor(private service: ResourcesService) { }

    /**
     * This controller will handle creating a resource endpoint which will allow clients to create a resource under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @param createResourceDto - The DTO that will be used to validate the data for creating a resource.
     * @return - A success response containing the resource information if the operation is successful.
     */


    @UseGuards(ClientGuard)
    @Post('create')
    @ApiOperation({ summary: 'Create a new resource (ORG_ADMIN only)' })
    @ApiResponse({ status: 201, description: 'Resource created successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
    async createResource(
        @CurrentUser() currentUser: User,
        @Body() createResourceDto: CreateResourceDto,
        @Res() res: Response
    ) {
        //Logic to create a resource will go here
        const resource = await this.service.createResource(currentUser, createResourceDto);
        return ResponseUtil.success(resource, res);
    }


    /**

     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @param updateResourceDto - The DTO that will be used to validate the data for updating a resource.
     * @return - A success response containing the updated resource information if the operation is successful.
     */

    @UseGuards(RolesGuard)
    @Roles(Role.ORG_ADMIN, Role.ADMIN,)
    @Patch('profile/:id')
    @ApiQuery({ name: 'clientId', required: true, description: 'Select Organization Client' })
    @ApiOperation({ summary: 'Update resource details (Admin and Client)' })
    @ApiResponse({ status: 200, description: 'Resource updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin or Client role required' })
    async updateResource(
        @Param('id') id: string,
        @Body() updateResourceDto: UpdateResourceDto,
        @Query('clientId') clientId: string,
        @Res() res: Response
    ) {
        // Logic to update a resource will go here
        // const resource = await this.service.updateResource(id, updateResourceDto, clientId, res);
        // return ResponseUtil.success(organization, res);

    }

    // get resource details endpoint will go here
    /**
     * This controller will handle all resource related endpoints such as creating a resource, updating resource details, fetching resource information, etc.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @return - A success response containing the resource information if the operation is successful.
     */

    @UseGuards(RolesGuard)
    @Roles(Role.ORG_ADMIN, Role.ADMIN)
    @Get('profile/:id')
    @ApiQuery({ name: 'clientId', required: false, description: 'Select Organization Client' })
    @ApiOperation({ summary: 'Get resource details (Client)' })
    @ApiResponse({ status: 200, description: 'Resource details fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Client role required' })
    async getResource(@CurrentUser() currentUser: User, @Param('id') id: string, @Query('clientId') clientId: string, @Res() res: Response) {
        // Logic to get a resource will go here
        // const resource = await this.service.getResource(currentUser, id, clientId, res);
        // return ResponseUtil.success(resource, res);
    }


}
