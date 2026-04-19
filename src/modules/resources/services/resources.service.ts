import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PlanType, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateResourceDto, UpdateResourceDto } from '../dto/resources.dto';
import {
    buildSubscriptionLimitMessage,
    isSubscriptionLimitReached,
    getSubscriptionLimits,

} from 'src/shared/constant/subscription.constant';
import { UpdateOrganizationDto } from 'src/modules/organization/dto/organization.dto';

@Injectable()
export class ResourcesService {

    constructor(private prisma: PrismaService) { }

    // Service method to create a resource
    async createResource(user: User, createResourceDto: CreateResourceDto) {
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
            },
        });

        return resource;
    }


    // Service method to update a resource
    async updateResource(user: User, resourceId: string, updateResourceDto: UpdateResourceDto) {
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
            return updatedResource

        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Something went wrong during update');
        }

    }

    // Service method to delete a resource
    async deleteResource(user: User, resourceId: string) {
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
            return deletedResource;
        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException('Something went wrong during delete');
        }
    }
}
