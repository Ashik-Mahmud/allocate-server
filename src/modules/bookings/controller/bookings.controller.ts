import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { BookingsService } from '../services/bookings.service';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { CreateBookingDto } from '../dto/bookings.dto';
import { ResponseUtil } from 'src/utils/responses';
import { Response } from 'express';


@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('bookings')
export class BookingsController {

    constructor(
        private service: BookingsService,
    ) { }

    /**
     * This controller will handle create booking endpoint which will allow clients to create a booking for a resource under their organization.
     * @param currentUser - The current authenticated user
     * @param createBookingDto - DTO for creating a booking
     * @param res - Response object
     * @returns - Success response with created booking data or error response
     */

    @UseGuards(RolesGuard)
    @Roles(Role.STAFF, Role.ORG_ADMIN) // Allow both ORG_MEMBER and ORG_ADMIN to create bookings
    @Post('create')
    @ApiOperation({ summary: 'Create a booking for a resource (STAFF and ORG_ADMIN roles)' })
    @ApiResponse({ status: 201, description: 'Booking created successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    async createBooking(@CurrentUser() currentUser: User, @Body() createBookingDto: CreateBookingDto, @Res() res: Response) {
        const result = await this.service.createBooking(currentUser, createBookingDto);
        return ResponseUtil.success(result, res);
    }


    


}
