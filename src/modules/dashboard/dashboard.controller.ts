import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AuthGuard) // Add appropriate guards here (e.g., AuthGuard)
export class DashboardController {

    constructor(private service: DashboardService) { }

    /**
     * Get Organization/Staff/Admin dashboard Overview
     * Returns key metrics and insights about the organization
     */
    @Get('overview')
    @ApiResponse({ status: 200, description: 'Organization/Staff/Admin dashboard overview' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiOperation({ summary: 'Get dashboard overview', description: 'Returns key metrics and insights about the dashboard for STAFF, ADMIN, ORG_ADMIN' })
    async getDashboardOverview(@CurrentUser() user: User) {
        // Placeholder for actual implementation
        switch (user.role) {
            case Role.ORG_ADMIN:
                return await this.service.getOrganizationOverview(user);
            case Role.STAFF:
                return await this.service.getStaffOverview(user);
            case Role.ADMIN:
                return await this.service.getAdminOverview(user);
        }
    }

}
