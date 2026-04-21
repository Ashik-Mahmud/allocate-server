import { Prisma, PrismaClient, Role, User } from "@prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { CreateStaffDto, ManageCreditsDto, ManageMultipleStaffCreditsDto, UpdateStaffDto } from "../dto/staff.dto";
import { CryptoUtils } from "src/modules/auth/utils/crypto";
import { EmailService } from "src/modules/inbox/service/email.service";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { StaffFilterDto } from "../dto/staff-filter.dto";

// Write staff service code
@Injectable()
export class StaffService {
    constructor(
        private prisma: PrismaService,
        private emailService: EmailService

    ) { }

    // Create a new staff member
    async createStaff(createStaffDto: CreateStaffDto, user: User) {
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


        // Hashed password 
        const hashedPassword = await CryptoUtils.hashPassword(password);


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
        try {
            await this.emailService.sendStaffInviteEmail({
                to: email,
                staffName: name,
                tempPassword: password,
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
                },
            }),
            this.prisma.user.count({ where: whereClause }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return { items, total, page, limit, totalPages };
    }

    // Get a specific staff member by ID
    async getStaffById(id: string, user: User) {
        const staff = await this.prisma.user.findFirst({
            where: { id, deletedAt: null, org_id: user.org_id, role: { in: [Role.STAFF, Role.ORG_ADMIN] } },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                photo: true,
                createdAt: true,
            },
        });
        if (!staff) {
            throw new NotFoundException('Staff member not found');
        }
        return staff;
    }

    // Update a staff member's information
    async updateStaff(id: string, updateStaffDto: UpdateStaffDto, user: User) {
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
            },
        });

        try {
            const updatedFields = Object.keys(updateStaffDto).filter(key => updateStaffDto[key] !== undefined);
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
    async deleteStaff(id: string, user: User) {
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
                organization: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        try {
            await this.emailService.sendStaffDeletionEmail(
                deletedStaff.email,
                deletedStaff.name,
                deletedStaff.organization?.name || 'Our Organization',
            );
        } catch (error) {
            console.error('Failed to send staff deletion email:', error);
        }
        return deletedStaff;
    }

    // Manage/Assign credits to a staff member
    async manageSingleStaffCredits(id: string, manageCreditsDto: ManageCreditsDto, user: User) {
        const { credits } = manageCreditsDto;
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
                    },
                });

                return updatedStaff;
            });
            await this.emailService.sendCreditAssignmentEmail(
                updatedStaff.email,
                updatedStaff.name,
                credits,
                staff.organization.name,
            ).catch((error) => {
                console.error('Failed to send credit assignment email:', error);
            });
            return updatedStaff;
        } catch (error) {
            console.error('Failed to send email:', error);
            throw new InternalServerErrorException('Failed to manage credits for the staff member');
        }

    }



    // Manage/Assign credits to multiple staff members
    async manageMultipleStaffCredits(manageCreditsDto: ManageMultipleStaffCreditsDto, user: User) {
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
                    this.emailService.sendCreditAssignmentEmail(
                        updated.email,
                        updated.name,
                        sc.credits,
                        organization.name,
                    ).catch(err => console.error('Email failed for:', updated.email, err));

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
    async getStaffCreditLogs(user: User) {}

}