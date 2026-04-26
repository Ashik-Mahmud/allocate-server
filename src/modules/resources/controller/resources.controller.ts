import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { ClientGuard, RolesGuard, SubscriptionGuard, UserVerificationGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ResponseUtil } from 'src/utils/responses';
import { CreateResourceDto, UpdateResourceDto, ListResourcesQueryDto } from '../dto/resources.dto';
import { Response } from 'express';
import { PlanType, Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { ResourcesService } from '../services/resources.service';
import { SubscriptionPlans } from 'src/shared/decorators/subscription.decorator';
import { CreateResourceRuleDto, UpdateResourceRuleDto } from '../dto/resources-rule.dto';
import { ResourcesRuleService } from '../services/resources-rule.service';


@ApiTags('Resources')
@ApiBearerAuth()
@UseGuards(AuthGuard, UserVerificationGuard)
// Only clients can create organizations
@Controller('resources')
export class ResourcesController {

    constructor(
        private service: ResourcesService,
        private resourcesRuleService: ResourcesRuleService

    ) { }

    /**
     * This controller will handle creating a resource endpoint which will allow clients to create a resource under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @param createResourceDto - The DTO that will be used to validate the data for creating a resource.
     * @visibleTo - ORG_ADMIN role only
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
        const resource = await this.service.createResource(currentUser, createResourceDto, res);
        return ResponseUtil.success(resource, res);
    }


    /**
     * This controller will handle updating a resource endpoint which will allow clients to update a resource under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @param updateResourceDto - The DTO that will be used to validate the data for updating a resource.
     * @param id - The ID of the resource to be updated.
     * @visibleTo - ORG_ADMIN role only
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
        const resource = await this.service.updateResource(currentUser, id, updateResourceDto, res);
        return ResponseUtil.success(resource, res);

    }

    /**
     * This controller will handle deleting a resource endpoint which will allow clients to delete a resource under their organization.
     * @param resourcesService - The service that will handle the business logic for resource related operations.
     * @param id - The ID of the resource to be deleted.
     * @visibleTo - ORG_ADMIN role only
     * @return - A success response confirming the deletion if the operation is successful.
     */

    @UseGuards(ClientGuard, SubscriptionGuard)
    @SubscriptionPlans(PlanType.FREE, PlanType.PRO, PlanType.ENTERPRISE)
    @Delete('delete/:id')
    @ApiOperation({ summary: 'Delete a resource (ORG_ADMIN only)' })
    @ApiResponse({ status: 200, description: 'Resource deleted successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - ORG_ADMIN role required' })
    async deleteResource(@CurrentUser() currentUser: User, @Param('id') id: string, @Res() res: Response) {
        // Logic to delete a resource will go here
        const resource = await this.service.deleteResource(currentUser, id, res);
        return ResponseUtil.success(resource, res);
    }


    /**
     * This controller will handle fetching resources endpoint which will allow clients to fetch all resources under their organization with pagination and search.
     * @param currentUser - The current authenticated user
     * @param query - Query parameters for pagination, search, and filtering
     * @param res - Response object
     * @visibleTo - ORG_ADMIN and STAFF roles
     * @return - A success response containing paginated array of resources if the operation is successful.
     */
    @UseGuards(RolesGuard)
    @Roles(Role.ORG_ADMIN, Role.STAFF)
    @Get('list')
    @ApiOperation({ summary: 'List resources with pagination, search, and filtering' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by resource name or type' })
    @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by resource type' })
    @ApiQuery({ name: 'is_available', required: false, type: String, enum: ['true', 'false'], description: 'Filter by availability' })
    @ApiQuery({ name: 'is_active', required: false, type: String, enum: ['true', 'false'], description: 'Filter by active status' })
    @ApiQuery({ name: 'is_maintenance', required: false, type: String, enum: ['true', 'false'], description: 'Filter by maintenance status' })
    @ApiQuery({ name: 'sortBy', required: false, type: String, enum: ['name', 'hourly_rate', 'createdAt'], description: 'Sort field (default: createdAt)' })
    @ApiQuery({ name: 'sortOrder', required: false, type: String, enum: ['asc', 'desc'], description: 'Sort order (default: desc)' })
    @ApiResponse({ status: 200, description: 'Resources fetched successfully with pagination' })
    @ApiResponse({ status: 400, description: 'Invalid query parameters' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    async listResources(@CurrentUser() currentUser: User, @Query() query: ListResourcesQueryDto, @Res() res: Response) {
        const result = await this.service.listResources(currentUser, query);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, res);
    }


    /**
     * This controller will handle fetching a single resource by ID.
     * @param currentUser - The current authenticated user
     * @param id - Resource ID
     * @param res - Response object
     * @visibleTo - ORG_ADMIN and STAFF roles
     * @return - A success response containing the resource if found.
     */
    @UseGuards(RolesGuard)
    @Roles(Role.ORG_ADMIN, Role.STAFF)
    @Get(':id')
    @ApiOperation({ summary: 'Get resource details by ID' })
    @ApiResponse({ status: 200, description: 'Resource fetched successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 404, description: 'Resource not found' })
    async getResource(@CurrentUser() currentUser: User, @Param('id') id: string, @Res() res: Response) {
        const resource = await this.service.getResourceById(currentUser, id);
        return ResponseUtil.success(resource, res);
    }


    /**
     * This controller will handle create/update resources rule endpoint which will allow clients to create/update rules for a resource under their organization.
     * @param currentUser - The current authenticated user
     * @param id - Resource ID
     * @param createRuleDto - DTO for creating a resource rule
     * @param res - Response object
     * @visibleTo - ORG_ADMIN role only
     * @return - A success response containing the created rule information if the operation is successful.
     */

    @UseGuards(ClientGuard, SubscriptionGuard)
    @Roles(Role.ORG_ADMIN)
    @Patch(':id/rules')
    @ApiOperation({ summary: 'Create/update resource rule for a resource  (ORG_ADMIN role only)' })
    @ApiResponse({ status: 201, description: 'Resource rule created/updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - ORG_ADMIN role required' })
    async createResourceRule(
        @CurrentUser() currentUser: User,
        @Param('id') id: string,
        @Body() updateResourceRule: UpdateResourceRuleDto, // Replace with actual DTO for creating a resource rule
        @Res() res: Response
    ) {
        // Logic to create a resource rule will go here
        const result = await this.resourcesRuleService.createResourceRule(updateResourceRule, currentUser, id, res);
        // For now, just return a success response with the provided data
        return ResponseUtil.success(result, res);
    }
}
