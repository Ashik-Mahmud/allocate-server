import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlanType, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto/organization.dto';
import { Response } from 'express';

@Injectable()
export class OrganizationService {

    constructor(private prisma: PrismaService) { }

    // This service will handle all organization related business logic such as creating an organization, updating organization details, fetching organization information, etc.


    // Create a new organization
    async createOrganization(createOrganizationDto: CreateOrganizationDto, clientId: string, response: Response) {


        // check if clientId is provided in the query parameters
        if (!clientId) {
            throw new Error(`Client with ID ${clientId} not found`);
        }

        // check if client exists in the database
        const client = await this.prisma.user.findUnique({
            where: { id: clientId },
        });

        if (!client) {
            throw new Error('Client not found');
        }

        // Create organization
        return await this.prisma.$transaction(async (prisma) => {
            const planType: PlanType =
                createOrganizationDto.plan_type &&
                    Object.values(PlanType).includes(createOrganizationDto.plan_type as PlanType)
                    ? (createOrganizationDto.plan_type as PlanType)
                    : PlanType.FREE;

            const organization = await prisma.organizations.create({
                data: {
                    ...createOrganizationDto,
                    plan_type: planType, // Default to FREE if not provided or invalid
                    
                },
            });

            await prisma.user.update({
                where: { id: clientId },
                data: { org_id: organization.id },
            });

            return organization;
        });

    }


    // Update organization details
    async updateOrganization(id: string, updateOrganizationDto: UpdateOrganizationDto, clientId: string, response: Response) {
        // check if clientId is provided in the query parameters
        if (!clientId) {
            throw new Error(`Client with ID ${clientId} not found`);
        }
        // check if client exists in the database
        const client = await this.prisma.user.findUnique({
            where: { id: clientId },
            select: { org_id: true },
        });

        if (!client) {
            throw new Error('Client not found');
        }

        if (client.org_id !== id) {
            throw new ForbiddenException('Client is not authorized to update this organization');
        }

        // Update organization
        return await this.prisma.organizations.update({
            where: { id },
            data: {
                ...updateOrganizationDto,
            },
        });
    }


    // Get organization details
    async getOrganization(currentUser: User, id: string, response: Response) {
        // check if clientId is provided in the query parameters
        if (!currentUser || !currentUser.org_id) {
            throw new Error(`Client with ID ${currentUser?.id} not found`);
        }

        if (currentUser.org_id !== id) {
            throw new ForbiddenException('Client is not authorized to access this organization');
        }

        // Get organization
        const organization = await this.prisma.organizations.findFirst({
            where: {
                id: id,
                users: {
                    some: {
                        id: currentUser.id,
                    },
                },
            },

        });

        if (!organization) {
            throw new Error('Organization not found');
        }

        return organization;
    }

}
