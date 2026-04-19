import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlanType, Role, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { Response } from 'express';
import { CreateResourceDto } from '../dto/resources.dto';

@Injectable()
export class ResourcesService {

    constructor(private prisma: PrismaService) { }

    // Service method to create a resource
    async createResource(user: User, createResourceDto: CreateResourceDto) {
        // Logic to create a resource will go here
        // This will include validating the client's subscription plan, checking if they have reached their resource limit, and then creating the resource in the database.

        //check if the client has an active subscription plan that allows for resource creation

        return { message: 'Resource created successfully', data: createResourceDto };
    }


}
