import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PlanType, Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { CreateResourceDto, UpdateResourceDto, ListResourcesQueryDto } from '../dto/resources.dto';
import {
    buildSubscriptionLimitMessage,
    isSubscriptionLimitReached,
    getSubscriptionLimits,
    isFeatureAccessible,
    buildSubscriptionAccessErrorMessage,

} from 'src/shared/constant/subscription.constant';
import { UpdateOrganizationDto } from 'src/modules/organization/dto/organization.dto';
import { CreateResourceRuleDto, UpdateResourceRuleDto } from '../dto/resources-rule.dto';
import { SharedService } from 'src/shared/services/shared.service';
import { Response } from 'express';

@Injectable()
export class ResourcesRuleService {

    constructor(private prisma: PrismaService, private sharedService: SharedService) { }


    // create resources rule
    async createResourceRule(updateResourcesRuleDto: UpdateResourceRuleDto, user: User, resourceId: string, res?: Response) {
        // Check if resource exists and belongs to the user's organization
        const resource = await this.prisma.resources.findFirst({
            where: { id: resourceId, org_id: user.org_id!, deletedAt: null },
            include: { organization: true, },
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }
        // Check if organization is active before allowing access to resources
        if (!resource?.organization.is_active) {
            throw new ForbiddenException('Your organization is not active. Please contact support.');
        }

        const currentPlan = resource?.organization.plan_type ?? PlanType.FREE;


        // check if current plat is FREE then we will not allow to create resource rule 
        if (!isFeatureAccessible(currentPlan, 'ADVANCED_RULES')) {
            const message = buildSubscriptionAccessErrorMessage(currentPlan, [PlanType.PRO, PlanType.ENTERPRISE]);
            throw new ForbiddenException(message);
        }


        try {
            const newRule = await this.prisma.resourcesRule.upsert({
                where: {
                    resource_id: resourceId!,
                    org_id: user.org_id!,
                },
                update: {
                    max_booking_hours: updateResourcesRuleDto.max_booking_hours,
                    min_lead_time: updateResourcesRuleDto.min_lead_time,
                    buffer_time: updateResourcesRuleDto.buffer_time,
                    opening_hours: updateResourcesRuleDto.opening_hours,
                    closing_hours: updateResourcesRuleDto.closing_hours,
                    slot_duration_min: updateResourcesRuleDto.slot_duration_min,
                    is_weekend_allowed: updateResourcesRuleDto.is_weekend_allowed,
                    availableDays: updateResourcesRuleDto.availableDays,
                    deletedAt: null,
                },
                create: {
                    org_id: user.org_id!,
                    resource_id: resourceId,
                    max_booking_hours: updateResourcesRuleDto.max_booking_hours,
                    min_lead_time: updateResourcesRuleDto.min_lead_time,
                    buffer_time: updateResourcesRuleDto.buffer_time,
                    opening_hours: updateResourcesRuleDto.opening_hours,
                    closing_hours: updateResourcesRuleDto.closing_hours,
                    slot_duration_min: updateResourcesRuleDto.slot_duration_min,
                    is_weekend_allowed: updateResourcesRuleDto.is_weekend_allowed,
                    availableDays: updateResourcesRuleDto.availableDays,
                },
            });
            // Log resource rule creation activity
            const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
            const userAgent = res?.req?.headers['user-agent'] || 'unknown';
            await this.sharedService.logActivity(this.prisma, {
                userId: user?.id,
                orgId: user?.org_id || resource?.org_id || '',
                action: newRule.createdAt.getTime() === newRule.updatedAt.getTime() ? 'RESOURCE_RULE_CREATE' : 'RESOURCE_RULE_UPDATE',
                details: `User ${user.email} created/updated resource rule`,
                ipAddress: ipAddress,
                userAgent: userAgent,
                metadata: { org_id: user?.org_id || '', role: user?.role, resource_id: resource?.id || '', resourceName: resource.name },
            });
            return newRule;
        } catch (error: any) {
            console.error('Error creating resource rule:', error);
            throw new InternalServerErrorException(error?.message ?? 'An error occurred while creating the resource rule. Please try again later.');
        }

    }





}
