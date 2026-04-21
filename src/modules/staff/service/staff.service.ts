import { PrismaClient, Role, User } from "@prisma/client";
import { PrismaService } from "src/modules/prisma/prisma.service";
import { CreateStaffDto } from "../dto/staff.dto";
import { CryptoUtils } from "src/modules/auth/utils/crypto";
import { EmailService } from "src/modules/inbox/service/email.service";
import { Injectable } from "@nestjs/common";

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
        if (!user?.org_id) {
            throw new Error('User is not associated with any organization');
        }
        // Check if the email already exists in the organization
        const existingStaff = await this.prisma.user.findFirst({
            where: {
                email,
                org_id: user?.org_id,
            },
            include: {
                organization: {
                    select: {
                        name: true
                    }
                }
            }
        });

        if (existingStaff) {
            throw new Error('A staff member with this email already exists in the organization');
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
                org_id: (org_id || user.org_id), // Associate the staff member with the same organization as the creator
            },
            include: {
                organization: {
                    select: {
                        name: true
                    }
                }
            }
        });

        this.emailService.sendStaffInviteEmail({
            to: email,
            staffName: name,
            tempPassword: password,
            webAppLink: process.env.WEB_APP_LINK || 'http://localhost:3000',
            organizationName: staff?.organization?.name,
            invitedBy: user?.name,
        });

        const { password: _, ...result } = staff;
        return result;

    }

}