
// Write admin controller code
import { Request, response, Response } from 'express';

import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { InboxService } from '../service/inbox.service';

@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('inbox')
export class InboxController {

    constructor(private inboxService: InboxService) { }

    /**
     * Add endpoint to send notifications
     * @param request - The incoming request object
     * @param response - The outgoing response object
     */


    @Post('/notification')
    @ApiResponse({ status: 200, description: 'System settings updated successfully.' })
    @ApiResponse({ status: 403, description: 'Forbidden.' })
    async sendNotification(@CurrentUser() user: User, @Body() notificationDto: any, @Res() response: Response) {
        // Implement logic to send notification here
        // You can use this.inboxService to call service methods for business logic
        response.status(200).json({ message: 'Notification sent successfully' });
    }

}
