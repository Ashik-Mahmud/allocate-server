import { Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';

@Injectable()
export class SharedService {
    /**
     * Activity log method to log user actions across the application
     */
    async logActivity(
        tx: Prisma.TransactionClient, // Prisma Transaction Client
        data: {
            userId: string;
            orgId: string;
            action: string;
            details?: string;
            metadata?: any;
            ipAddress?: string;
            userAgent?: string;
        }
    ) {
        return await tx.activityLog.create({
            data: {
                user_id: data.userId,
                org_id: data.orgId,
                action: data.action,
                details: data.details,
                metadata: data.metadata || {},
                ipAddress: data.ipAddress || '',
                userAgent: data.userAgent || '',
            },
        });
    }

    /**
     * Credit transaction log method to log credit transactions across the application
     */
    async createCreditTransaction(
        tx: Prisma.TransactionClient,
        data: {
            userId?: string;
            orgId: string;
            amount: number;
            type: TransactionType;
            prevBalance: number;
            currBalance: number;
            refId?: string;
            description?: string;
            performedBy: string;
            price_paid?: number;
        }
    ) {
        return await tx.creditTransaction.create({
            data: {
                user_id: data?.userId || data.performedBy,
                org_id: data.orgId,
                amount: data.amount,
                type: data.type,
                currentBalance: data.currBalance,
                previousBalance: data.prevBalance,
                referenceId: data.refId,
                description: data.description,
                performedBy: data.performedBy,
                price_paid: data.price_paid || 0,
            },
        });
    }

    generatePassword(length: number = 12) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        let password = '';
        for (let i = 0; i < length; i++) {
            const randomNum = Math.floor(Math.random() * chars.length);
            password += chars.charAt(randomNum);
        }
        return password;
    }
}