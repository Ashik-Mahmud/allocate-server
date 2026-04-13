import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShiftDto, UpdateShiftDto } from '../dto/shift.dto';
import { Shift } from '@prisma/client';

@Injectable()
export class ShiftService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateShiftDto): Promise<Shift> {
    return this.prisma.shift.create({
      data: {
        userId,
        startTime: new Date(dto.startTime),
        endTime: dto.endTime ? new Date(dto.endTime) : null,
        rate: dto.rate,
        description: dto.description,
        hoursWorked: dto.endTime
          ? (new Date(dto.endTime).getTime() - new Date(dto.startTime).getTime()) / (1000 * 60 * 60)
          : null,
      },
    });
  }

  async findAll(userId: string): Promise<Shift[]> {
    return this.prisma.shift.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
    });
  }

  async findOne(userId: string, id: string): Promise<Shift> {
    const shift = await this.prisma.shift.findFirst({
      where: { id, userId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    return shift;
  }

  async update(userId: string, id: string, dto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findOne(userId, id);

    const updateData: any = { ...dto };
    if (dto.startTime) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime) updateData.endTime = new Date(dto.endTime);

    // Recalculate hours if both times are provided
    if ((dto.startTime || shift.startTime) && (dto.endTime || shift.endTime)) {
      const start = dto.startTime ? new Date(dto.startTime) : shift.startTime;
      const end = dto.endTime ? new Date(dto.endTime) : shift.endTime!;
      updateData.hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }

    return this.prisma.shift.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id); // Check ownership
    await this.prisma.shift.delete({
      where: { id },
    });
  }

  async calculatePayroll(userId: string, shiftId: string): Promise<any> {
    const shift = await this.findOne(userId, shiftId);

    if (!shift.hoursWorked || !shift.endTime) {
      throw new Error('Shift must be completed to calculate payroll');
    }

    const totalPay = shift.hoursWorked * shift.rate;

    // Create or update payroll
    const payroll = await this.prisma.payroll.upsert({
      where: { shiftId },
      update: {
        totalPay,
        periodStart: shift.startTime,
        periodEnd: shift.endTime,
      },
      create: {
        userId,
        shiftId,
        totalPay,
        periodStart: shift.startTime,
        periodEnd: shift.endTime,
        status: 'PENDING',
      },
    });

    return payroll;
  }
}