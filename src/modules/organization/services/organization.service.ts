import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlanType, Role, User } from '@prisma/client';
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


            const organization = await prisma.organizations.create({
                data: {
                    ...createOrganizationDto,

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
    async getOrganization(currentUser: User, id: string, clientId: string, response: Response) {


        const targetedUserId = clientId || currentUser.id;

        // If the user is an admin, they can access any organization
        if (currentUser.role === Role.ADMIN) {
            // Admin can access any organization
            const organization = await this.prisma.organizations.findUnique({
                where: { id, deletedAt: null },
            });

            if (!organization) throw new Error('Organization not found');
            return organization;
        }

        // Get organization for CLient
        const organization = await this.prisma.organizations.findFirst({
            where: {
                id: id,
                users: {
                    some: {
                        id: targetedUserId,
                    },
                },
            },

        });

        if (!organization) {
            throw new Error('Organization not found or access denied');
        }

        return organization;
    }

}
