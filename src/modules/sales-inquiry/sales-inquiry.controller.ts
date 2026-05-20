import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from 'src/shared/guards';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { Role, SalesInquiry } from '@prisma/client';
import { SalesInquiryService } from './sales-inquiry.service';
import {
  CreateSalesInquiryDto,
  UpdateSalesInquiryDto,
  SalesInquiryFiltersDto,
  SalesInquiryStatsFiltersDto,
  SalesInquiryStatsFiltersSchema,
} from './sales-inquiry.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateSalesInquirySchema,
  UpdateSalesInquirySchema,
  SalesInquiryFiltersSchema,
} from './sales-inquiry.dto';
import { PaginatedResponse, ResponseUtil } from 'src/utils/responses';
import { Response } from 'express';
import {
  CurrentUser,
  CurrentUserType,
} from 'src/shared/decorators/user.decorator';

@ApiTags('Sales Inquiry')
@ApiBearerAuth()
@Controller('sales-inquiry')
export class SalesInquiryController {
  constructor(private readonly salesInquiryService: SalesInquiryService) {}

  /**
   * Create a new sales inquiry
   * Public endpoint - no authentication required
   */
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ORG_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createInquiry(
    @Body(new ZodValidationPipe(CreateSalesInquirySchema))
    data: CreateSalesInquiryDto,
    @Res() response: Response,
  ) {
    const inquiry = await this.salesInquiryService.createSalesInquiry(data);
    return ResponseUtil.success(inquiry, response);
  }

  /**
   * Get all sales inquiries with filters
   * Admin only endpoint
   */
  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'CONTACTED', 'CLOSED', 'CONVERTED'],
  })
  @ApiQuery({ name: 'org_id', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'name', 'status'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllInquiries(
    @Query(new ZodValidationPipe(SalesInquiryFiltersSchema))
    filters: SalesInquiryFiltersDto,
    @CurrentUser() user: CurrentUserType,
    @Res() response: Response,
  ): Promise<PaginatedResponse<Partial<SalesInquiry>>> {
    const result = await this.salesInquiryService.getAllInquiries(
      filters,

    );
    return ResponseUtil.paginated(
      result?.items,
      result?.total,
      result?.page,
      result?.limit,
      response,
    );
  }

  /**
   * Get sales inquiry statistics
   * Admin only endpoint
   */
  @Get('admin/stats')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiQuery({ name: 'org_id', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getStats(
    @Res() response: Response,
    @Query(new ZodValidationPipe(SalesInquiryStatsFiltersSchema))
    filters: SalesInquiryStatsFiltersDto,
  ): Promise<any> {
    const stats = await this.salesInquiryService.getStats(filters);
    return ResponseUtil.success(stats, response);
  }

  /**
   * Get sales inquiry details by ID
   * Admin only endpoint
   */
  @Get('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async getInquiryDetails(@Param('id') id: string, @Res() response: Response) {
    const inquiry = await this.salesInquiryService.getInquiryById(id);
    return ResponseUtil.success(inquiry, response);
  }

  /**
   * Update sales inquiry (status update, notes, etc)
   * Admin only endpoint
   */
  @Patch('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async updateInquiry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSalesInquirySchema))
    data: UpdateSalesInquiryDto,
    @Res() response: Response,
  ) {
    const inquiry = await this.salesInquiryService.updateInquiry(id, data);
    return ResponseUtil.success(inquiry, response);
  }

  /**
   * Delete sales inquiry (only CLOSED status can be deleted)
   * Admin only endpoint
   */
  @Delete('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async deleteInquiry(@Param('id') id: string, @Res() response: Response) {
    const result = await this.salesInquiryService.deleteInquiry(id);
    return ResponseUtil.success(result, response);
  }
}
