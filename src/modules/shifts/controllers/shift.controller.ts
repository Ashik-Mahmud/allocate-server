import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ShiftService } from '../services/shift.service';
import { CreateShiftDto, UpdateShiftDto } from '../dto/shift.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ResponseUtil } from '../../../utils/responses';

@ApiTags('shifts')
@Controller('shifts')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ShiftController {
  constructor(private readonly shiftService: ShiftService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiResponse({ status: 201, description: 'Shift created successfully' })
  async create(@Req() req: Request, @Body() dto: CreateShiftDto, @Res() res: Response) {
    const shift = await this.shiftService.create(req.user!.id, dto);
    return ResponseUtil.success(shift, res);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user shifts' })
  @ApiResponse({ status: 200, description: 'Shifts retrieved successfully' })
  async findAll(@Req() req: Request, @Res() res: Response) {
    const shifts = await this.shiftService.findAll(req.user!.id);
    return ResponseUtil.success(shifts, res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific shift' })
  @ApiResponse({ status: 200, description: 'Shift retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async findOne(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const shift = await this.shiftService.findOne(req.user!.id, id);
    return ResponseUtil.success(shift, res);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a shift' })
  @ApiResponse({ status: 200, description: 'Shift updated successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
    @Res() res: Response,
  ) {
    const shift = await this.shiftService.update(req.user!.id, id, dto);
    return ResponseUtil.success(shift, res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a shift' })
  @ApiResponse({ status: 200, description: 'Shift deleted successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async remove(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    await this.shiftService.remove(req.user!.id, id);
    return ResponseUtil.success({ message: 'Shift deleted successfully' }, res);
  }

  @Post(':id/payroll')
  @ApiOperation({ summary: 'Calculate payroll for a shift' })
  @ApiResponse({ status: 200, description: 'Payroll calculated successfully' })
  async calculatePayroll(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const payroll = await this.shiftService.calculatePayroll(req.user!.id, id);
    return ResponseUtil.success(payroll, res);
  }
}