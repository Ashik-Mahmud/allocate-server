import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DashboardService } from './dashboard.service';
import { CurrentUser, CurrentUserType } from 'src/shared/decorators/user.decorator';
import { PlanType, Role, User } from '@prisma/client';
import { ClientGuard, RolesGuard, StaffGuard, SubscriptionGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { SubscriptionPlans } from 'src/shared/decorators/subscription.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AuthGuard) // Add appropriate guards here (e.g., AuthGuard)
export class DashboardController {

    constructor(private service: DashboardService) { }

    /**
     * Get System Admin dashboard Overview
     * Returns key metrics and insights about the organization
     */
    @Get('system-insights')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN) // Only ADMIN role can access this endpoint
    @ApiResponse({ status: 200, description: 'System Admin dashboard overview' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiOperation({ summary: 'Get dashboard overview', description: 'Returns key metrics and insights about the dashboard for system administrators' })
    async getDashboardOverview(@CurrentUser() user: User) {
        // Placeholder for actual implementation
        const result = await this.service.getAdminOverview(user);
        return {
            insights: result,
            message: 'Key metrics and insights about the dashboard'
        };
    }

    /**
     * Get Organization dashboard Insights
     * Returns detailed insights and analytics about the organization
     * This endpoint can be used to fetch more granular data for analysis and decision-making
     */
    @Get('organization-insights')
    @UseGuards(ClientGuard)
    @ApiResponse({ status: 200, description: 'Organization/Staff/Admin dashboard insights' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiOperation({ summary: 'Get organization insights', description: 'Returns detailed insights and analytics about the organization for STAFF, ADMIN, ORG_ADMIN' })
    async getOrganizationInsights(@CurrentUser() user: User & CurrentUserType) {
        // Placeholder for actual implementation
        let result;
        if (user?.plan_type !== PlanType.FREE) {
            result = await this.service.getOrganizationOverviewV2(user);
        } else {
            result = await this.service.getOrganizationOverview(user);
        }
        return {
            insights: result,
            message: 'Detailed insights and analytics about the organization'
        };
    }

    @Get('organization-insights-v2')
    @UseGuards(ClientGuard, SubscriptionGuard)
    @SubscriptionPlans(PlanType.PRO, PlanType.ENTERPRISE) // Only PRO and ENTERPRISE plans can access this endpoint
    @ApiResponse({ status: 200, description: 'Organization strategic summary for admins' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiOperation({
        summary: 'Get organization insights v2',
        description: 'Returns executive summary, critical alerts, activity insights, and recommendations for ORG_ADMIN',
    })
    async getOrganizationInsightsV2(@CurrentUser() user: User & CurrentUserType) {
        const result = await this.service.getOrganizationOverviewV2(user);
        return {
            insights: result,
            message: 'Strategic organization summary and recommendations',
        };
    }

    /**
     * Get Staff dashboard Metrics
     * Returns specific metrics related to the staff, such as user activity, resource usage, etc.
     * This endpoint can be used to fetch specific metrics for monitoring and performance tracking
     */
    @Get('staff-insights')
    @UseGuards(RolesGuard)
    @Roles(Role.STAFF, Role.ADMIN, Role.ORG_ADMIN) // STAFF, ADMIN, and ORG_ADMIN roles can access this endpoint
    @ApiResponse({ status: 200, description: 'Organization/Staff/Admin dashboard metrics' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiOperation({ summary: 'Get staff insights', description: 'Returns specific metrics related to the staff for STAFF, ADMIN, ORG_ADMIN' })
    async getStaffInsights(@CurrentUser() user: User & CurrentUserType) {
        // Placeholder for actual implementation
        const result = await this.service.getStaffOverview(user);
        return {
            insights: result,
            message: 'Specific metrics related to the staff'
        };
    }



}
