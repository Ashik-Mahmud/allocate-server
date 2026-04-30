import { NotificationType, PlanType, Prisma, PrismaClient, Role, TransactionType, User } from "@prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { CreateStaffDto, ManageCreditsDto, ManageMultipleStaffCreditsDto, UpdateStaffDto } from "../dto/staff.dto";
import { CryptoUtils } from "src/modules/auth/utils/crypto";
import { EmailService } from "src/modules/inbox/service/email.service";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { CreditLogsFilterDto, StaffFilterDto } from "../dto/staff-filter.dto";
import { buildSubscriptionLimitMessage, getSubscriptionLimits, isSubscriptionLimitReached } from "src/shared/constant/subscription.constant";
import { Response } from "express";
import { SharedService } from "src/shared/services/shared.service";
import { NotificationManager } from "src/modules/inbox/service/notification-manager.service";

// Write staff service code
@Injectable()
export class StaffService {
    constructor(
        private prisma: PrismaService,
        private emailService: EmailService,
        private sharedService: SharedService,
        private NotificationManager: NotificationManager
    ) { }

    // Create a new staff member
    async createStaff(createStaffDto: CreateStaffDto, user: User, res: Response) {
        const { email, name, password, photo, org_id } = createStaffDto;

        // check if the user has any accosciated organization
        const targetOrgId = org_id || user.org_id;
        if (!targetOrgId) {
            throw new ForbiddenException('You must belong to an organization to create staff');
        }
        // Check if the email already exists in the organization
        const existingUser = await this.prisma.user.findUnique({
            where: { email, deletedAt: null },
        });

        if (existingUser) {
            throw new ConflictException('A user with this email already exists in the system');
        }

        const organization = await this.prisma.organizations.findUnique({
            where: { id: targetOrgId },
            select: {
                id: true,
                plan_type: true,
                is_active: true,
                _count: {
                    select: {
                        users: {
                            where: { deletedAt: null }
                        }
                    }
                }
            },
        })
        if (!organization || !organization.is_active) {
            throw new NotFoundException('Organization not found');
        }

        const currentPlan = organization.plan_type ?? PlanType.FREE;
        const currentUsersCount = organization._count.users ?? 0;

        if (isSubscriptionLimitReached(currentPlan, 'MAX_USERS', currentUsersCount)) {
            const { MAX_USERS } = getSubscriptionLimits(currentPlan);
            throw new ForbiddenException(
                buildSubscriptionLimitMessage(currentPlan, 'users', MAX_USERS),
            );
        }


        // Hashed password 
        const tempPassword = password || this.sharedService.generatePassword();
        const hashedPassword = await CryptoUtils.hashPassword(tempPassword);


        // Create the staff member
        const staff = await this.prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                photo,
                role: Role.STAFF,
                org_id: targetOrgId,
                is_verified: true, // Staff accounts created by admin are considered verified
            },
            include: {
                organization: { select: { name: true } }
            }
        });
        // Log the activity
        const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
        const userAgent: string = res.req.headers['user-agent'] || 'unknown';
        await this.sharedService.logActivity(this.prisma, {
            userId: user.id,
            orgId: targetOrgId,
            action: 'CREATE_STAFF',
            details: `Created staff member with email ${email}`,
            ipAddress: ipAddress,
            userAgent: userAgent,
            metadata: { org_id: targetOrgId, role: user.role },
        });

        // Send welcome email
        try {
            await this.emailService.sendStaffInviteEmail({
                to: email,
                staffName: name,
                tempPassword: tempPassword,
                webAppLink: process.env.WEB_APP_LINK || 'http://localhost:3000',
                organizationName: staff?.organization?.name || 'Our Organization',
                invitedBy: user?.name,
            });
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

        const { password: _, ...result } = staff;
        return result;

    }


    // Get all staff members in the organization
    async getStaffMembersList(user: User, query: StaffFilterDto) {
        const orgId = user.org_id;
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const { search, email, } = query;


        const whereClause: Prisma.UserWhereInput = {
            org_id: orgId,
            deletedAt: null,

            role: {
                in: [Role.STAFF, Role.ORG_ADMIN],
            },
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            } : {}),
            ...(email ? { email: { contains: email, mode: 'insensitive' } } : {}),
        };


        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where: whereClause,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    photo: true,
                    createdAt: true,
                    personal_credits: true,
                    organization: {
                        select: {
                            name: true,
                        },
                    },
                    is_verified: true,
                    last_login: true,
                    org_id: true,

                },
            }),
            this.prisma.user.count({ where: whereClause }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return { items, total, page, limit, totalPages };
    }

    // Get a specific staff member by ID
    async getStaffById(id: string, user: User) {
        console.log(id, 'id')
        const staff = await this.prisma.user.findFirst({
            where: { id, deletedAt: null, org_id: user.org_id, role: { in: [Role.STAFF, Role.ORG_ADMIN] } },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                photo: true,
                createdAt: true,
                org_id: true,
                organization: true,
                is_verified: true,
                creditTransactions: true,
                personal_credits: true,
                last_login: true,
                updatedAt: true,
            },
        });
        if (!staff) {
            throw new NotFoundException('Staff member not found');
        }
        return staff;
    }

    // Update a staff member's information
    async updateStaff(id: string, updateStaffDto: UpdateStaffDto, user: User, res: Response) {
        const { email, name, password, photo } = updateStaffDto;
        const staff = await this.prisma.user.findFirst({
            where: { id, deletedAt: null, org_id: user.org_id, role: { in: [Role.STAFF, Role.ORG_ADMIN] } },
        });
        if (!staff) {
            throw new NotFoundException('Staff member not found');
        }
        if (email && email !== staff.email) {
            const existingUser = await this.prisma.user.findUnique({
                where: { email, },
            });
            if (existingUser) {
                throw new ConflictException('A user with this email already exists in the system');
            }
        }

        const updateData: Prisma.UserUpdateInput = {
            name,
            email,
            photo,
        };

        if (password) {
            updateData.password = await CryptoUtils.hashPassword(password);
        }

        const updatedStaff = await this.prisma.user.update({
            where: { id, org_id: user.org_id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                photo: true,
                createdAt: true,
                org_id: true,

            },
        });

        // Log the activity
        const updatedFields = Object.keys(updateStaffDto).filter(key => updateStaffDto[key] !== undefined);
        const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
        const userAgent: string = res.req.headers['user-agent'] || 'unknown';
        await this.sharedService.logActivity(this.prisma, {
            userId: user.id,
            orgId: user.org_id || updatedStaff?.org_id || '',
            action: 'UPDATE_STAFF',
            details: `Updated staff member with email ${updatedStaff.email}`,
            ipAddress: ipAddress,
            userAgent: userAgent,
            metadata: { org_id: user.org_id, role: user.role, updatedFields: updatedFields },
        });

        // Send email notification about profile update
        try {

            await this.emailService.sendUpdateStaffProfileInfoByOrganizationEmail(
                updatedStaff.email,
                updatedStaff.name,
                updatedFields,
            );
        } catch (error) {
            console.error('Failed to send email:', error);
        }
        return updatedStaff;
    }


    // Soft delete a staff member
    async deleteStaff(id: string, user: User, res: Response) {
        const staff = await this.prisma.user.findFirst({
            where: { id, deletedAt: null, org_id: user.org_id, role: { in: [Role.STAFF, Role.ORG_ADMIN] } },
        });
        if (!staff) {
            throw new NotFoundException('Staff member not found');
        }

        if (staff.id === user.id) {
            throw new BadRequestException('You cannot delete your own account');
        }
        const deletedStaff = await this.prisma.user.update({
            where: { id, org_id: user.org_id },
            data: {
                deletedAt: new Date(),
                email: `${staff.email}-deleted-${Date.now()}`, // To prevent email conflicts in the future
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                photo: true,
                createdAt: true,
                org_id: true,
                organization: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        // Log the activity
        const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
        const userAgent: string = res.req.headers['user-agent'] || 'unknown';
        await this.sharedService.logActivity(this.prisma, {
            userId: user.id,
            orgId: user.org_id || deletedStaff?.org_id || '',
            action: 'DELETE_STAFF',
            details: `Deleted staff member with email ${deletedStaff.email}`,
            ipAddress: ipAddress,
            userAgent: userAgent,
            metadata: { org_id: user.org_id, role: user.role },
        });
        // Send email notification about account deletion
        try {
            await this.emailService.sendStaffDeletionEmail(
                staff.email,
                deletedStaff.name,
                deletedStaff.organization?.name || 'Our Organization',
            );
        } catch (error) {
            console.error('Failed to send staff deletion email:', error);
        }
        return deletedStaff;
    }

    // Manage/Assign credits to a staff member
    async manageSingleStaffCredits(id: string, manageCreditsDto: ManageCreditsDto, user: User, res: Response) {
        const { credits } = manageCreditsDto;
     
      
        if (!id) throw new BadRequestException('Staff ID is required');
        const staff = await this.prisma.user.findFirst({
            where: { id, deletedAt: null, org_id: user.org_id, role: { in: [Role.STAFF, Role.ORG_ADMIN] } },
            include: { organization: { select: { name: true, credit_pool: true, id: true } } }
        });
        if (!staff || !staff.organization?.id) {
            throw new NotFoundException('Staff member not found');
        }

        if (Number(staff?.organization?.credit_pool || 0) < credits) {
            throw new BadRequestException('Insufficient credits in the organization pool');
        }

        try {
            const updatedStaff = await this.prisma.$transaction(async (tx) => {
                // Deduct credits from organization pool
                await tx.organizations.update({
                    where: { id: staff.organization?.id },
                    data: {
                        credit_pool: { decrement: credits },
                    },
                });

                // Add credits to staff member
                const updatedStaff = await tx.user.update({
                    where: { id, org_id: user.org_id },
                    data: {
                        personal_credits: {
                            increment: credits,
                        },
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        photo: true,
                        createdAt: true,
                        org_id: true,
                        organization: {
                            select: {
                                name: true,
                            },
                        },
                    },
                });
                // creadit transaction log
                await this.sharedService.createCreditTransaction(tx, {
                    userId: staff.id,
                    orgId: staff.org_id || '',
                    amount: credits,
                    type: TransactionType.ALLOCATE,
                    prevBalance: Number(staff.personal_credits || 0),
                    currBalance: Number(staff.personal_credits || 0) + credits,
                   // refId: `credit-${Date.now()}`,
                    description: `Assigned ${credits} credits to staff member with email ${staff.email} by ${user.email}`,
                    performedBy: user.id, 
                    price_paid: 0, // Assuming no price for internal credit allocation, adjust if needed

                });

                return updatedStaff;
            });


            // Notification (in-app and email and push and sms if needed) about credit assignment
            this.NotificationManager.send({
                userId: staff.id,
                orgId: staff.org_id || '',
                emailSubject: 'Credit Assignment',
                title: 'Credit Assignment',
                message: `You have been assigned ${credits} credits in the organization ${staff.organization.name}. You can use these credits to book resources. If you have any questions, please contact your administrator.`,
                type: NotificationType.CREDIT_RECEIVED,
                userEmail: staff.email,
                userName: staff.name,
                metadata: { org_id: staff.org_id, role: staff.role, assignedCredits: credits },
            })

            // Log the activity
            const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
            const userAgent: string = res.req.headers['user-agent'] || 'unknown';
            await this.sharedService.logActivity(this.prisma, {
                userId: user.id,
                orgId: staff.org_id || '',
                action: 'MANAGE_CREDITS',
                details: `Assigned ${credits} credits to staff member with email ${staff.email}`,
                metadata: { org_id: staff.org_id, role: user.role, assignedCredits: credits },
                ipAddress: ipAddress,
                userAgent: userAgent,
            });





            return updatedStaff;
        } catch (error) {
            console.error('Failed to send email:', error);
            throw new InternalServerErrorException('Failed to manage credits for the staff member');
        }

    }

    // revoke credits from staff member and return to organization pool
    async revokeStaffCredits(id: string, manageCreditsDto: ManageCreditsDto, user: User, res: Response) {
        const { credits } = manageCreditsDto;
        if (!id) throw new BadRequestException('Staff ID is required');
        const staff = await this.prisma.user.findFirst({
            where: { id, deletedAt: null, org_id: user.org_id, role: { in: [Role.STAFF, Role.ORG_ADMIN] } },
            include: { organization: { select: { name: true, credit_pool: true, id: true } } }
        });
        if (!staff || !staff.organization?.id) {
            throw new NotFoundException('Staff member not found');
        }

        if (Number(staff?.personal_credits || 0) < credits) {
            throw new BadRequestException('Staff member does not have enough credits to revoke');
        }

        try {
            const updatedStaff = await this.prisma.$transaction(async (tx) => {
                // Add credits to organization pool
                await tx.organizations.update({
                    where: { id: staff.organization?.id },
                    data: {
                        credit_pool: { increment: credits },
                    },
                });


                // Deduct credits from staff member
                const updatedStaff = await tx.user.update({
                    where: { id, org_id: user.org_id },
                    data: {
                        personal_credits: {
                            decrement: credits,
                        },
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        photo: true,
                        createdAt: true,
                        org_id: true,
                        organization: {
                            select: {
                                name: true,
                            },
                        },
                    },
                });
                // creadit transaction log
                await this.sharedService.createCreditTransaction(tx, {
                    userId: staff.id,
                    orgId: staff.org_id || '',
                    amount: credits,
                    type: TransactionType.REVOKE,
                    prevBalance: Number(staff.personal_credits || 0),
                    currBalance: Number(staff.personal_credits || 0) - credits,
                    refId: `credit-${Date.now()}`,
                    description: `Revoked ${credits} credits from staff member with email ${staff.email} by ${user.name}`,
                    performedBy: user.id,
                });
                return updatedStaff;
            });

            // Notification (in-app and email and push and sms if needed) about credit revocation
            this.NotificationManager.send({
                userId: staff.id,
                orgId: staff.org_id || '',
                emailSubject: 'Credit Revocation',
                title: 'Credit Revocation',
                message: `You have been revoked ${credits} credits in the organization ${staff.organization.name}. If you have any questions, please contact your administrator.`,
                type: NotificationType.CREDIT_REVOKED,
                userEmail: staff.email,
                userName: staff.name,
                metadata: { org_id: staff.org_id, role: staff.role, revokedCredits: credits },
            })

            // Log the activity
            const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
            const userAgent: string = res.req.headers['user-agent'] || 'unknown';
            await this.sharedService.logActivity(this.prisma, {
                userId: user.id,
                orgId: staff.org_id || '',
                action: 'REVOKE_CREDITS',
                details: `Revoked ${credits} credits from staff member with email ${staff.email}`,
                metadata: { org_id: staff.org_id, role: user.role, revokedCredits: credits },
                ipAddress: ipAddress,
                userAgent: userAgent,
            });


            return updatedStaff;
        } catch (error) {
            console.error('Failed to send email:', error);
            throw new InternalServerErrorException('Failed to manage credits for the staff member');
        }

    }


    // Manage/Assign credits to multiple staff members
    async manageMultipleStaffCredits(manageCreditsDto: ManageMultipleStaffCreditsDto, user: User, res: Response) {
        const { staffCredits } = manageCreditsDto;
        const orgId = user?.org_id;

        if (!orgId) {
            throw new ForbiddenException('You must belong to an organization to manage staff credits');
        }

        const organization = await this.prisma.organizations.findUnique({
            where: { id: orgId },
            select: { id: true, name: true, credit_pool: true }
        });

        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        const totalRequiredCredits = staffCredits.reduce((sum, item) => sum + item.credits, 0);

        if (Number(organization.credit_pool || 0) < totalRequiredCredits) {
            throw new BadRequestException('Insufficient credits in the organization pool for this operation');
        }

        try {
            const updatedStaffs = await this.prisma.$transaction(async (tx) => {

                await tx.organizations.update({
                    where: { id: orgId },
                    data: { credit_pool: { decrement: totalRequiredCredits } },
                });
                const updates = staffCredits.map(async (sc) => {
                    const staff = await tx.user.findFirst({
                        where: { id: sc.staff_id, org_id: orgId, deletedAt: null }
                    });

                    if (!staff) throw new NotFoundException(`Staff ${sc.staff_id} not found`);

                    const updated = await tx.user.update({
                        where: { id: sc.staff_id },
                        data: { personal_credits: { increment: sc.credits } },
                        select: { id: true, name: true, email: true }
                    });

                    // Send email notification for each staff member
                    this.NotificationManager.send({
                        userId: staff.id,
                        orgId: orgId,
                        emailSubject: 'Credit Assignment',
                        title: 'Credit Assignment',
                        message: `You have been assigned ${sc.credits} credits in the organization ${organization.name}. You can use these credits to book resources. If you have any questions, please contact your administrator.`,
                        type: NotificationType.CREDIT_RECEIVED,
                        userEmail: staff.email,
                        userName: staff.name,
                        metadata: { org_id: orgId, role: staff.role, assignedCredits: sc.credits },
                    })

                    // Log the activity
                    const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
                    const userAgent: string = res.req.headers['user-agent'] || 'unknown';
                    await this.sharedService.logActivity(this.prisma, {
                        userId: user.id,
                        orgId: orgId,
                        action: 'MANAGE_CREDITS',
                        details: `Assigned ${sc.credits} credits to staff member with email ${staff.email}`,
                        metadata: { org_id: orgId, role: user.role, assignedCredits: sc.credits },
                        ipAddress: ipAddress,
                        userAgent: userAgent,
                    });

                    // creadit transaction log
                    await this.sharedService.createCreditTransaction(this.prisma, {
                        userId: staff.id,
                        orgId: orgId,
                        amount: sc.credits,
                        type: TransactionType.ALLOCATE,
                        prevBalance: Number(staff.personal_credits || 0),
                        currBalance: Number(staff.personal_credits || 0) + sc.credits,
                        refId: `credit-${Date.now()}`,
                        description: `Assigned ${sc.credits} credits to staff member with email ${staff.email} by ${user.name}`,
                        performedBy: user.id,
                    });


                    return updated;
                });

                return Promise.all(updates);
            });
            return updatedStaffs;
        }
        catch (error) {
            console.error('Failed to send email:', error);
            throw new InternalServerErrorException('Failed to manage credits for the multiple staff members');
        }
    }



    // Get staff credit logs history
    async getStaffCreditLogs(user: User, query: CreditLogsFilterDto, res: Response) {
        const orgId = user?.org_id;
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        const search = query.search || '';
        const staffId = query.staff_id || '';

        if (!orgId) {
            throw new BadRequestException('User does not belong to any organization');
        }

        const whereClause: Prisma.CreditTransactionWhereInput = {
            org_id: orgId,
            type: { in: [TransactionType.ALLOCATE, TransactionType.SPEND, TransactionType.REVOKE] },
            ...(staffId ? { user_id: staffId } : {}),
            ...(search ? {
                OR: [
                    { description: { contains: search, mode: 'insensitive' } },
                    { referenceId: { contains: search, mode: 'insensitive' } },
                    { user: { name: { contains: search, mode: 'insensitive' } } }
                ],
            } : {}),
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.creditTransaction.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                            photo: true
                        }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.creditTransaction.count({ where: whereClause }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

}