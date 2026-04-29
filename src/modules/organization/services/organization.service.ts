import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlanType, Role, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto/organization.dto';
import { Response } from 'express';
import { SharedService } from 'src/shared/services/shared.service';

@Injectable()
export class OrganizationService {

    constructor(private prisma: PrismaService, private sharedService: SharedService) { }

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

            const user = await prisma.user.update({
                where: { id: clientId },
                data: { org_id: organization.id },
            });
            // Log activity for organization creation
            await this.sharedService.logActivity(this.prisma, {
                userId: clientId,
                orgId: organization.id,
                action: 'ORGANIZATION_CREATE',
                details: `Organization created: ${organization.name}`,
                ipAddress: (response?.req?.headers['x-forwarded-for'] as string) || response?.req?.ip || response?.req?.connection?.remoteAddress || '',
                userAgent: response.req.headers['user-agent'] || 'unknown',
                metadata: { planType: PlanType.FREE, orgId: organization.id, createdBy: user.name || user.email },
            });

            return organization;
        });

    }


    // Update organization details
    async updateOrganization(id: string, updateOrganizationDto: UpdateOrganizationDto, clientId: string, response: Response) {
        // check if clientId is provided in the query parameters

        console.log(updateOrganizationDto, 'updateOrganizationDto')
      
        const targetedUserId = id || clientId ;
        if (!targetedUserId) {
            throw new Error(`Client with ID ${targetedUserId} not found`);
        }
        // check if client exists in the database
        const client = await this.prisma.user.findUnique({
            where: { id: targetedUserId },
            select: { org_id: true, name: true, email: true, organization: { select: { id: true, name: true } } },
        });

        if (!client || !client.organization || !client?.org_id) {
            throw new Error('Client not found or client is not associated with any organization');
        }

        if (client.org_id !== client?.org_id) {
            throw new ForbiddenException('Client is not authorized to update this organization');
        }

        // Log activity for organization creation
        const changedFields = Object.keys(updateOrganizationDto).join(', ');
        const previousFields = { changedFields };
        const currentChangedValues = Object.values(updateOrganizationDto).join(', ');
        const details = `Organization updated: ${client?.organization?.name || ''}. Changed fields: ${changedFields}. Previous values: ${JSON.stringify(previousFields)}. Current values: ${currentChangedValues}`;
        await this.sharedService.logActivity(this.prisma, {
            userId: targetedUserId,
            orgId: client?.org_id || '',
            action: 'ORGANIZATION_UPDATE',
            details: details,
            ipAddress: (response?.req?.headers['x-forwarded-for'] as string) || response?.req?.ip || response?.req?.connection?.remoteAddress || '',
            userAgent: response.req.headers['user-agent'] || 'unknown',
            metadata: {
                orgId: client.org_id,
                updatedBy: client.name || client.email,
                changedFields: changedFields.split(', '),
            },
        });
        // Update organization
        return await this.prisma.organizations.update({
            where: { id: client?.org_id },
            data: {
                needUpdateOrg: false,
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
