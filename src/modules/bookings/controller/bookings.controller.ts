import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { BookingsService } from '../services/bookings.service';
import { RolesGuard, SubscriptionGuard, UserVerificationGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { BookingStatus, PlanType, Role, User } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { CreateBookingDto, UpdateBookingStatusDto } from '../dto/bookings.dto';
import { ResponseUtil } from 'src/utils/responses';
import { Response } from 'express';
import { AllBookingsQueryDto, BookingStatsQueryDto, MyBookingsHistoryQueryDto } from '../dto/booking-filter.dto';
import { SubscriptionPlans } from 'src/shared/decorators/subscription.decorator';


@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard, UserVerificationGuard)
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
        const result = await this.service.createBooking(currentUser, createBookingDto, res);
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
    async updateBookingStatus(
        @CurrentUser() currentUser: User,
        @Query('bookingId') bookingId: string,
        @Body() updateBookingStatusDto: UpdateBookingStatusDto, // Optional cancellation reason when status is CANCELLED
        @Res() res: Response
    ) {
        const result = await this.service.updateBookingStatus(currentUser, bookingId, updateBookingStatusDto, res);
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
    @ApiQuery({ name: 'status', enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'], required: false, description: 'Filter bookings by status' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by resource name or type' })
    @ApiOperation({ summary: 'Get all bookings for the current user\'s organization (STAFF and ORG_ADMIN roles)' })
    @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })

    async getMyBookingsHistory(@CurrentUser() currentUser: User, @Query() query:  MyBookingsHistoryQueryDto, @Res() res: Response) {
        const result = await this.service.getMyBookingsHistoryService(currentUser, query);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, res);
    }


    /**
     * This controller will get all the bookings for their organization. It will allow clients to retrieve a list of all bookings associated with their organization.
     * @param currentUser - The current authenticated user
     * @param res - Response object
     * @returns - Success response with list of bookings or error response
     */

    @UseGuards(RolesGuard)
    @Roles(Role.ORG_ADMIN) // Only ORG_ADMIN can view all bookings for the organization
    @Get('all')
    @ApiOperation({ summary: 'Get all bookings for the organization (ORG_ADMIN role only)' })
    @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiQuery({ name: 'status', enum: ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'], required: false, description: 'Filter bookings by status' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
    @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by resource name or type' })
    @ApiQuery({ name: 'userId', required: false, type: String, description: 'Filter by user ID' })
    @ApiQuery({ name: 'resourceId', required: false, type: String, description: 'Filter by resource ID' })
    @ApiQuery({ name: 'dateRange', required: false, type: String, description: 'Filter by date range (e.g. "2024-01-01 to 2024-01-07")' })
    async getAllBookings(@CurrentUser() currentUser: User, @Query('query') query: AllBookingsQueryDto, @Res() res: Response) {
        const result = await this.service.getAllBookings(currentUser, query);
        return ResponseUtil.paginated(result.items, result.total, result.page, result.limit, res);
    }


    /**
     * This controller will get all the bookings for the resource for the whole month based on the staff selection month and year.
     * It will allow clients to retrieve a list of all bookings associated with a resource for a specific month and year.
     * @param currentUser - The current authenticated user
     * @param res - Response object
     * @returns - Success response with list of bookings or error response
     */
    @UseGuards(RolesGuard, SubscriptionGuard)
    @SubscriptionPlans(PlanType.PRO, PlanType.ENTERPRISE) // Allow access based on subscription plan
    @Roles(Role.STAFF, Role.ORG_ADMIN) // Allow both ORG_MEMBER and ORG_ADMIN to view bookings for a resource
    @Get('resource/:resourceId/calendar')
    @ApiOperation({ summary: 'Get all bookings for a resource for a specific month and year (STAFF and ORG_ADMIN roles)' })
    @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiParam({ name: 'resourceId', type: 'string', description: 'ID of the resource to get bookings for' })
    @ApiQuery({ name: 'month', type: Number, description: 'Month to filter bookings by (1-12)' })
    @ApiQuery({
        name: 'year', type: Number, description: 'Year to filter bookings by (e.g. 2024)'
    })
    async getBookingsByResourceAndMonth(
        @CurrentUser() currentUser: User,
        @Param('resourceId') resourceId: string,
        @Query('month') month: number,
        @Query('year') year: number,
        @Res() res: Response
    ) {
        const result = await this.service.getBookingsByResourceAndMonth(currentUser, resourceId, month, year);
        return ResponseUtil.success(result, res);
    }


    /**
     * This controller will get all the admin bookings stats for the organization. It will allow clients to retrieve various statistics related to bookings for their organization, such as total bookings, upcoming bookings, and booking trends over time.
     * @param currentUser - The current authenticated user
     * @param res - Response object
     */
    @UseGuards(RolesGuard)
    @Roles(Role.ORG_ADMIN) // Only ORG_ADMIN can view booking stats for the organization
    @Get('stats')
    @ApiOperation({ summary: 'Get booking statistics for the organization (ORG_ADMIN role only)' })
    @ApiResponse({ status: 200, description: 'Booking statistics retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized - Token required' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date for statistics (e.g. "2024-01-01")' })
    @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date for statistics (e.g. "2024-01-31")' })
    @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], description: 'Group statistics by time period' })
    async getBookingStats(@CurrentUser() currentUser: User, @Query() query: BookingStatsQueryDto, @Res() res: Response) {
        const result = await this.service.getBookingStats(currentUser, query);
        return ResponseUtil.success(result, res);
    }


}
