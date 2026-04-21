
// Write admin controller code
import { Request, response, Response } from 'express';
import { AdminService } from '../service/admin.service';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Patch, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { UpdateSystemSettingsDto } from '../dto/admin.dto';
import { CurrentUser } from 'src/shared/decorators/user.decorator';

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
    async updateSystemSettings(@CurrentUser() user: User, @Body() updateSystemSettingsDto: UpdateSystemSettingsDto, @Res() response: Response) {
        // Implement logic to update system settings here
        // You can use this.adminService to call service methods for business logic
        response.status(200).json({ message: 'System settings updated successfully' });
    }

}
