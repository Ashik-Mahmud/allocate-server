import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    NotificationType,
    Prisma,
    Role,
    SaleInquiryStatus,
} from '@prisma/client';
import { EmailService } from '../inbox/service/email.service';
import { InboxService } from '../inbox/service/inbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateSalesInquiryDto,
    SalesInquiryFiltersDto,
    SalesInquiryStatsFiltersDto,
    UpdateSalesInquiryDto,
} from './sales-inquiry.dto';

@Injectable()
export class SalesInquiryService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private inboxService: InboxService,
  ) {}

  // Create a new sales inquiry
  async createSalesInquiry(data: CreateSalesInquiryDto) {
    const inquiry = await this.prisma.salesInquiry.create({
      data: {
        ...data,
        team_size: data.team_size || null,
        org_id: data.org_id || null,
        status: SaleInquiryStatus.PENDING,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            business_email: true,
          },
        },
      },
    });

    // Send in App notification to org admin if org_id is provided
    const systemAdmin = await this.prisma.user.findFirst({
      where: { role: Role.ADMIN, org_id: null },
      select: { id: true },
    });

    const message = `A new sales inquiry has been received from ${inquiry.name} (${inquiry.business_email}). Please review and follow up accordingly. Inquiry details: 
        ${inquiry.message}`;

    this.inboxService
      .createNotification({
        userId: systemAdmin?.id || '', // Assuming system admin is the recipient
        orgId: inquiry?.org_id || '',
        type: NotificationType.CONTACT_SALES,
        title: `New Sales Inquiry Received : ${inquiry.organization?.name || 'Unknown Organization'}`,
        message: message,
      })
      .catch((err) =>
        console.error('Failed to create in-app notification:', err),
      );

    this.sendInquiryEmails(inquiry).catch((err) =>
      console.error('Email background process failed:', err),
    );
    return inquiry;
  }

  private async sendInquiryEmails(inquiry: any) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SENDER_EMAIL;

    try {
      await Promise.all([
        // Email to requester
        this.emailService.sendGlobalEmail({
          to: inquiry.business_email,
          name: inquiry.name,
          subject: 'Thank You for Your Sales Inquiry',
          htmlTemplateId: 'sales_inquiry_thank_you',
          metadata: { name: inquiry.name },
          htmlContent: '',
        }),
        // Email to admin about new inquiry
        adminEmail
          ? this.emailService.sendGlobalEmail({
              to: adminEmail,
              name: 'Admin',
              subject: 'New Sales Inquiry Received',
              htmlTemplateId: 'sales_inquiry',
              metadata: {
                inquiry,
              },
              htmlContent: '',
            })
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Failed to send sales inquiry emails:', error);
    }
  }

  // Get all sales inquiries with filters and pagination
  async getAllInquiries(
    filters: SalesInquiryFiltersDto,
  ) {
    const {
      status,
      org_id,
      country,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.SalesInquiryWhereInput = {
      ...(status && { status }),
      ...(org_id && { org_id }),
      ...(country && {
        country: { contains: country, mode: 'insensitive' },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { business_email: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [inquiries, total] = await Promise.all([
      this.prisma.salesInquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.salesInquiry.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: inquiries,
      total,
      page,
      limit,
      totalPages,
    };
  }

  // Get single inquiry by ID
  async getInquiryById(id: string) {
    const inquiry = await this.prisma.salesInquiry.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            business_email: true,
          },
        },
      },
    });

    if (!inquiry) {
      throw new NotFoundException(`Sales inquiry with ID ${id} not found`);
    }

    return inquiry;
  }

  // Update sales inquiry (status, notes, etc.)
  async updateInquiry(id: string, data: UpdateSalesInquiryDto) {
    await this.getInquiryById(id);
    const updated = await this.prisma.salesInquiry.update({
      where: { id },
      data: {
        ...data,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  // Delete sales inquiry (only CLOSED status can be deleted)
  async deleteInquiry(id: string) {
    const inquiry = await this.getInquiryById(id);

    if (inquiry.status !== SaleInquiryStatus.CLOSED) {
      throw new BadRequestException(
        `Only inquiries with status 'CLOSED' can be deleted. Current status: ${inquiry.status}`,
      );
    }

    await this.prisma.salesInquiry.delete({ where: { id } });

    return {
      success: true,
      message: 'Sales inquiry deleted successfully',
    };
  }

  // Get statistics
  async getStats(filters: SalesInquiryStatsFiltersDto) {
    const { org_id, startDate, endDate } = filters;
    const where: any = {};
    if (org_id) where.org_id = org_id;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get all inquiries for stats
    const allInquiries = await this.prisma.salesInquiry.findMany({
      where,
    });

    // Total leads
    const totalLeads = allInquiries.length;

    // Pending today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pendingToday = allInquiries.filter(
      (inquiry) =>
        inquiry.status === SaleInquiryStatus.PENDING &&
        inquiry.createdAt >= today &&
        inquiry.createdAt < tomorrow,
    ).length;

    // Conversion rate
    const convertedCount = allInquiries.filter(
      (inquiry) => inquiry.status === SaleInquiryStatus.CONVERTED,
    ).length;
    const conversionRate =
      totalLeads > 0 ? (convertedCount / totalLeads) * 100 : 0;

    // By country
    const byCountry: any = {};
    allInquiries.forEach((inquiry) => {
      const country = inquiry.country || 'Unknown';
      byCountry[country] = (byCountry[country] || 0) + 1;
    });

    // By team size
    const byTeamSize: any = {};

    allInquiries.forEach((inquiry) => {
      const size = inquiry.team_size! || 'Unknown';
      byTeamSize[size] = (byTeamSize[size] || 0) + 1;
    });

    // By status
    const byStatus = {
      [SaleInquiryStatus.PENDING]: 0,
      [SaleInquiryStatus.CONTACTED]: 0,
      [SaleInquiryStatus.CLOSED]: 0,
      [SaleInquiryStatus.CONVERTED]: 0,
    };

    allInquiries.forEach((inquiry) => {
      byStatus[inquiry.status]++;
    });

    return {
      success: true,
      data: {
        totalLeads,
        pendingToday,
        conversionRate: conversionRate.toFixed(2) + '%',
        byCountry,
        byTeamSize,
        byStatus,
      },
    };
  }
}
