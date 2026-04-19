import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard, SubscriptionGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ResponseUtil } from 'src/utils/responses';
import { CreateResourceDto, UpdateResourceDto, } from '../dto/resources.dto';
import { Response } from 'express';
import { PlanType, Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { ResourcesService } from '../services/resources.service';
import { SubscriptionPlans } from 'src/shared/decorators/subscription.decorator';


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
    @UseGuards(ClientGuard, SubscriptionGuard)
    @SubscriptionPlans(PlanType.FREE, PlanType.PRO, PlanType.ENTERPRISE)
    @Post('create')
    @ApiOperation({ summary: 'Create a new resource (ORG_ADMIN only)' })
    @ApiResponse({ status: 201, description: 'Resource created successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Subscription plan required' })
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
     * This controller will handle updating a resource endpoint which will allow clients to update a resource under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @param updateResourceDto - The DTO that will be used to validate the data for updating a resource.
     * @return - A success response containing the updated resource information if the operation is successful.
     */

    @UseGuards(ClientGuard, SubscriptionGuard)
    @SubscriptionPlans(PlanType.FREE, PlanType.PRO, PlanType.ENTERPRISE)
    @Patch('update/:id')
    @ApiOperation({ summary: 'Update resource details (ORG_ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Resource updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin or Client role required' })
    async updateResource(
        @CurrentUser() currentUser: User,
        @Param('id') id: string,
        @Body() updateResourceDto: UpdateResourceDto,
        @Res() res: Response
    ) {
        // Logic to update a resource will go here
        const resource = await this.service.updateResource(currentUser, id, updateResourceDto);
        return ResponseUtil.success(resource, res);

    }

    /**
     * This controller will handle deleting a resource endpoint which will allow clients to delete a resource under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @return - A success response confirming the deletion if the operation is successful.
     */

    @UseGuards(ClientGuard, SubscriptionGuard)
    @SubscriptionPlans(PlanType.FREE, PlanType.PRO, PlanType.ENTERPRISE)
    @Patch('delete/:id')
    @ApiOperation({ summary: 'Delete a resource (ORG_ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Resource deleted successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - ORG_ADMIN role required' })
    async deleteResource(@CurrentUser() currentUser: User, @Param('id') id: string, @Res() res: Response) {
        // Logic to delete a resource will go here
        const resource = await this.service.deleteResource(currentUser, id);
        return ResponseUtil.success(resource, res);
    }


    /**
     * This controller will handle fetching resources endpoint which will allow clients to fetch all resources under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @return - A success response containing an array of resources if the operation is successful.
     */
    @UseGuards(ClientGuard)
    @Get('all')
    @ApiOperation({ summary: 'Fetch all resources under the organization' })
    @ApiResponse({ status: 200, description: 'Resources fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    async fetchResources(@CurrentUser() currentUser: User,  @Res() res: Response) {
        // Logic to fetch resources will go here
        const resources = await this.service.getAllResources(currentUser, );
        return ResponseUtil.success(resources, res);
    }


}
