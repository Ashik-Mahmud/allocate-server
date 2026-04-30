import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PlanType, Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateResourceDto, UpdateResourceDto, ListResourcesQueryDto } from '../dto/resources.dto';
import {
    buildSubscriptionLimitMessage,
    isSubscriptionLimitReached,
    getSubscriptionLimits,

} from 'src/shared/constant/subscription.constant';
import { UpdateOrganizationDto } from 'src/modules/organization/dto/organization.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { Response } from 'express';
import { is } from 'zod/v4/locales';

@Injectable()
export class ResourcesService {

    constructor(private prisma: PrismaService, private sharedService: SharedService) { }

    // Service method to create a resource
    async createResource(user: User, createResourceDto: CreateResourceDto, res?: Response) {
        if (!user.org_id) {
            throw new ForbiddenException('User organization not found');
        }
        const organization = await this.prisma.organizations.findUnique({
            where: { id: user.org_id },
            select: {
                id: true,
                plan_type: true,
                is_active: true,
                _count: {
                    select: {
                        resources: {
                            where: { deletedAt: null }
                        }
                    }
                }
            },
        });
        if (!organization || organization.is_active === false) {
            throw new ForbiddenException('Your organization is not active. Please contact support.');
        }

        const currentPlan = organization.plan_type ?? PlanType.FREE;
        const currentResourceCount = organization._count.resources;

        if (isSubscriptionLimitReached(currentPlan, 'MAX_RESOURCES', currentResourceCount)) {
            const { MAX_RESOURCES } = getSubscriptionLimits(currentPlan);
            throw new ForbiddenException(
                buildSubscriptionLimitMessage(currentPlan, 'resources', MAX_RESOURCES),
            );
        }

        const resource = await this.prisma.resources.create({
            data: {
                org_id: organization.id,
                ...createResourceDto,
                metadata: createResourceDto.metadata ?? {},

                resourcesRules: {
                    create: {
                        org_id: user.org_id,
                        max_booking_hours: 2,
                        min_lead_time: 1,
                        buffer_time: 0.25,
                        opening_hours: 9,
                        closing_hours: 18,
                        slot_duration_min: 30,
                        is_weekend_allowed: true,
                        availableDays: [
                            "Saturday", "Sunday", "Monday",
                            "Tuesday", "Wednesday", "Thursday", "Friday"
                        ],
                    },
                }
            },
        });

        // Log resource creation activity
        const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
        const userAgent = res?.req?.headers['user-agent'] || 'unknown';
        await this.sharedService.logActivity(this.prisma, {
            userId: user?.id,
            orgId: user?.org_id || resource?.org_id || '',
            action: 'RESOURCE_CREATE',
            details: `User ${user.email} created resource`,
            ipAddress: ipAddress,
            userAgent: userAgent,
            metadata: { org_id: user?.org_id || '', role: user?.role, resource_id: resource?.id || '' },
        });

        return resource;
    }


    // Service method to update a resource
    async updateResource(user: User, resourceId: string, updateResourceDto: UpdateResourceDto, res?: Response) {
        if (!user.org_id) {
            throw new ForbiddenException('User organization not found');
        }

        try {
            const resource = await this.prisma.resources.findFirst({
                where: {
                    id: resourceId,
                    org_id: user.org_id,
                    deletedAt: null,
                },
                include: { organization: true },
            });

            if (!resource) {
                throw new NotFoundException('Resource not found in your organization');
            }

            if (resource.organization.is_active === false) {
                throw new ForbiddenException('Your organization is not active. Please contact support.');
            }

            // meta data change 
            const finalMetadata = updateResourceDto.metadata
                ? { ...(resource.metadata as object), ...(updateResourceDto.metadata as object) }
                : resource.metadata;
            const updatedResource = await this.prisma.resources.update({
                where: { id: resourceId },
                data: {
                    ...updateResourceDto,
                    metadata: finalMetadata ?? {},
                },
            });

            // Log resource update activity
            const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
            const userAgent = res?.req?.headers['user-agent'] || 'unknown';
            const updatedFields = Object.keys(updateResourceDto).join(', ');
            await this.sharedService.logActivity(this.prisma, {
                userId: user?.id,
                orgId: user?.org_id || resource?.org_id || '',
                action: 'RESOURCE_UPDATE',
                details: `User ${user.email} updated resource`,
                ipAddress: ipAddress,
                userAgent: userAgent,
                metadata: { org_id: user?.org_id || '', role: user?.role, resource_id: resource?.id || '', updatedFields },
            });
            return updatedResource;

        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Something went wrong during update');
        }

    }

    // Service method to delete a resource
    async deleteResource(user: User, resourceId: string, res?: Response) {
        if (!user.org_id) {
            throw new ForbiddenException('User organization not found');
        }

        try {
            const resource = await this.prisma.resources.findFirst({
                where: {
                    id: resourceId,
                    org_id: user.org_id,
                    deletedAt: null,
                },
                include: {
                    organization: true,
                    _count: {
                        select: {
                            bookings: {
                                where: {
                                    end_time: { gte: new Date() },
                                    status: { notIn: ['REJECTED', 'CANCELLED'] },
                                    deletedAt: null,
                                },
                            },
                        }
                    }

                },
            });

            if (!resource) {
                throw new NotFoundException('Resource not found in your organization');
            }

            if (resource.organization.is_active === false) {
                throw new ForbiddenException('Your organization is not active. Please contact support.');
            }

            // If there are upcoming bookings for the resource, prevent deletion
            if (resource._count.bookings > 0) {
                throw new ForbiddenException('Cannot delete resource with upcoming bookings. Please cancel the bookings first.');
            }

            const deletedResource = await this.prisma.resources.update({
                where: { id: resourceId },
                data: { deletedAt: new Date() },
            });

            // Log resource deletion activity
            const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
            const userAgent = res?.req?.headers['user-agent'] || 'unknown';
            await this.sharedService.logActivity(this.prisma, {
                userId: user?.id,
                orgId: user?.org_id || resource?.org_id || '',
                action: 'RESOURCE_DELETE',
                details: `User ${user.email} deleted resource`,
                ipAddress: ipAddress,
                userAgent: userAgent,
                metadata: { org_id: user?.org_id || '', role: user?.role, resource_id: resource?.id || '', resourceName: resource.name },
            });
            
            return deletedResource;
        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Something went wrong during delete');
        }
    }

    // Service method to list resources with pagination, search, and filtering
    async listResources(user: User, query: ListResourcesQueryDto) {
        const { page, limit, search, type, is_available, is_active, is_maintenance, sortBy, sortOrder } = query;
        if (!user.org_id) {
            throw new ForbiddenException('User organization not found');
        }

        const organization = await this.prisma.organizations.findUnique({
            where: { id: user.org_id },
            select: { id: true, is_active: true },
        });
        // Check if organization is active before allowing access to resources
        if (!organization || organization.is_active === false) {
            throw new ForbiddenException('Your organization is not active. Please contact support.');
        }

        // Build where conditions
        const whereConditions: Prisma.ResourcesWhereInput = {
            org_id: user.org_id,
            deletedAt: null,
            ...(type && { type: { contains: type, mode: 'insensitive' } }),
            ...(is_available !== undefined && { is_available }),
            ...(is_active !== undefined && { is_active }),
            ...(is_maintenance !== undefined && { is_maintenance }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { type: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        // Build sort order
        const orderBy: Prisma.ResourcesOrderByWithRelationInput[] = [
            sortBy
                ? ({ [sortBy]: sortOrder || 'desc' } as Prisma.ResourcesOrderByWithRelationInput)
                : { createdAt: sortOrder || 'desc' },

           // If is_maintenance is true then show those in the end
            { is_maintenance: 'asc' },
            
        ];

        // Calculate pagination
        const skip = (page - 1) * query.limit;

        try {
            const [total, resources] = await Promise.all([
                this.prisma.resources.count({ where: whereConditions }),
                this.prisma.resources.findMany({
                    where: whereConditions,
                    orderBy,
                    skip: skip,
                    take: limit,

                    select: {
                        id: true,
                        org_id: true,
                        name: true,
                        type: true,
                        hourly_rate: true,
                        is_available: true,
                        is_active: true,
                        is_maintenance: true,
                        photo: true,
                        metadata: true,
                        createdAt: true,
                        updatedAt: true,

                        organization: {
                            select: {
                                id: true,
                                name: true,
                                org_type: true,
                                credit_pool: true,
                                photo: true,
                                slug: true,
                            },
                        },

                        resourcesRules: true, // Include resource rules in the response
                        _count: {
                            select: {
                                bookings: true,
                            },
                        },
                    },

                }),
            ]);
            return {
                items: resources,
                total,
                page: query.page,
                limit: query.limit,
                totalPages: Math.ceil(total / query.limit),
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch resources');
        }
    }

    // Service method to get a single resource by ID
    async getResourceById(user: User, resourceId: string) {
        if (!user.org_id) {
            throw new ForbiddenException('User organization not found');
        }

        try {
            const resource = await this.prisma.resources.findFirst({
                where: {
                    id: resourceId,
                    org_id: user.org_id,
                    deletedAt: null,
                },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    resourcesRules: true, // Include resource rules in the response
                    _count: {
                        select: {
                            bookings: true,
                        },
                    },
                },
            });

            if (!resource) {
                throw new NotFoundException('Resource not found in your organization');
            }

            return resource;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Failed to fetch resource');
        }
    }


}
