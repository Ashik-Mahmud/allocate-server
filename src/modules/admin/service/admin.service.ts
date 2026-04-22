import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/prisma.service";

// Write admin service code
@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) {
        // Initialize any necessary properties or dependencies here
    }

}