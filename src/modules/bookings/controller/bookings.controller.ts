import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { BookingsService } from '../services/bookings.service';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { BookingStatus, Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { CreateBookingDto } from '../dto/bookings.dto';
import { ResponseUtil } from 'src/utils/responses';
import { Response } from 'express';
import { MyBookingsHistoryQueryDto } from '../dto/booking-filter.dto';


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


    /**
     * This controller will handle booking status update endpoint which will allow clients to update the status of a booking (e.g. cancel a booking).
     * @param currentUser - The current authenticated user
     * @param updateBookingDto - DTO for updating a booking
     * @param res - Response object
     * @returns - Success response with updated booking data or error response
     */

    @UseGuards(RolesGuard)
    @Roles(Role.STAFF, Role.ORG_ADMIN) // Allow both ORG_MEMBER and ORG_ADMIN to update bookings
    @Patch('status')
    @ApiOperation({ summary: 'Update booking status (STAFF and ORG_ADMIN roles)' })
    @ApiResponse({ status: 200, description: 'Booking status updated successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiQuery({ name: 'bookingId', type: 'string', description: 'ID of the booking to update' })
    @ApiQuery({
        name: 'status',
        enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'],
        description: 'New status for the booking'
    })
    async updateBookingStatus(
        @CurrentUser() currentUser: User,
        @Query('bookingId') bookingId: string,
        @Query('status') status: BookingStatus,
        @Res() res: Response
    ) {
        const result = await this.service.updateBookingStatus(currentUser, bookingId, status);
        return ResponseUtil.success(result, res);
    }


    /**
     * This controller will handle a available slots by the resources and date range. It will allow clients to get the available slots for a resource within a specified date range.
     *  @param resourceId - The ID of the resource to check availability for
     * @dateRange - The date range to check availability for (e.g. "2024-01-01 to 2024-01-07")
     * @returns - Success response with available slots data or error response
     */

    @UseGuards(RolesGuard)
    @Roles(Role.STAFF, Role.ORG_ADMIN) // Allow both ORG_MEMBER and ORG_ADMIN to view available slots
    @Get('availability/:resourceId')
    @ApiOperation({ summary: 'Get available slots for a resource within a date range (STAFF and ORG_ADMIN roles)' })
    @ApiResponse({ status: 200, description: 'Available slots retrieved successfully' })
    @ApiResponse({ status: 400, description: 'Bad Request - Invalid input data' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiParam({ name: 'resourceId', type: 'string', description: 'ID of the resource to check availability for' })
    @ApiQuery({ name: 'date', type: 'string', description: 'Date  to check availability for (e.g. "2024-01-01")' })
    async getAvailableSlots(
        @Param('resourceId') resourceId: string,
        @Query('date') date: string,
        @Res() res: Response
    ) {
        const result = await this.service.getAvailableSlotsByResource(resourceId, date);
        return ResponseUtil.success(result, res);
    }


    /**
     *  This controller will get all the bookings for the current user's organization. It will allow clients to retrieve a list of all bookings associated with their organization.
     * @param currentUser - The current authenticated user
     * @param res - Response object
     * @returns - Success response with list of bookings or error response
     */

    @UseGuards(RolesGuard)
    @Roles(Role.STAFF, Role.ORG_ADMIN) // Allow both ORG_MEMBER and ORG_ADMIN to view bookings
    @Get('my-bookings')
    @ApiOperation({ summary: 'Get all bookings for the current user\'s organization (STAFF and ORG_ADMIN roles)' })
    @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiQuery({ name: 'status', enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'], required: false, description: 'Filter bookings by status' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by resource name or type' })
    async getMyBookingsHistory(@CurrentUser() currentUser: User, @Query('query') query: MyBookingsHistoryQueryDto, @Res() res: Response) {
        const result = await this.service.getMyBookingsHistory(currentUser, query);
        return ResponseUtil.success(result, res);
    }


}
