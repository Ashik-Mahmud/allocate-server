import { Injectable } from '@nestjs/common';
import { CreateCheckoutDto } from './payments.dto';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { SUBSCRIPTION_LIMITS, SUBSCRIPTION_PRICING } from 'src/shared/constant/subscription.constant';
import { NotificationType, PaymentProvider, PaymentStatus, PlanType, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
const Stripe = require('stripe');
import { env } from 'src/shared/config/env';
import { Request } from 'express';
import { SharedService } from 'src/shared/services/shared.service';
import { NotificationManager } from '../inbox/service/notification-manager.service';
@Injectable()
export class PaymentsService {
    private stripe: typeof Stripe;

    constructor(
        private prisma: PrismaService,
        private sharedService: SharedService,
        private notificationManager: NotificationManager
    ) {
        this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
            apiVersion: '2020-08-27' as any,
        });
    }

    // Create a Stripe checkout session
    async createCheckoutSession(dto: CreateCheckoutDto, user: CurrentUserType) {
        const { planType, months, currency = 'USD' } = dto;
        const userId = user.id;

        // 1. Get the base price for the selected plan and currency
        const pricing = SUBSCRIPTION_PRICING[planType ?? PlanType.PRO][currency];

        let totalAmount = 0;

        // basic logic
        if (months === 12) {
            // if exactly 12 months, use the annual package (already discounted)
            totalAmount = pricing.annually;
        } else if (months > 12) {
            // if more than 12 months (e.g., 14 months), use annual + remaining months at monthly rate
            const years = Math.floor(months / 12);
            const remainingMonths = months % 12;
            totalAmount = (years * pricing.annually) + (remainingMonths * pricing.monthly);
        } else {
            // if less than 12 months, use the regular monthly rate
            totalAmount = months * pricing.monthly;
        }
        // amount in cents for Stripe
        const stripeAmount = Math.round(totalAmount * 100);

        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `Allocate ${planType} Plan`,
                            description: `${months} months subscription of ${planType} plan.`,
                        },
                        unit_amount: stripeAmount,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                userId,
                planType: planType ?? PlanType.PRO,
                months: months.toString(),
                currency: currency,
                org_id: user?.org_id,
                email: user?.email,
            },
            success_url: `${env.WEB_APP_LINK}/dashboard/billing?payment=success`,
            cancel_url: `${env.WEB_APP_LINK}/pricing`,
        });

        return { url: session.url };
    }


    // Handle Stripe webhook for payment events
    async handleStripeWebhook(signature: string, req: any) {
        let event;

        try {
            // payload এর বদলে সরাসরি req.rawBody ব্যবহার করতে হবে
            event = this.stripe.webhooks.constructEvent(
                req.rawBody,
                signature,
                env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err: any) {

            console.error(`❌ Webhook Error: ${err.message}`);
            throw new Error(`Webhook Error: ${err.message}`);
        }

        const session = event.data.object;

        // Idempotency check: Ensure we haven't already processed this session
        const existingSession = await this.prisma.subscription.findFirst({
            where: {
                external_id: session.id,
                payment_status: PaymentStatus.COMPLETED
            }
        });

        if (existingSession) {
            console.log(`⚠️ Session ${session.id} already processed. Skipping...`);
            return { received: true };
        }

        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {

            const { userId, planType, months, currency, org_id, email } = session.metadata;

            // update subscription status in your database
            const subscription = await this.prisma.$transaction(async (tx) => {

                const organization = await tx.organizations.findFirst({
                    where: { id: org_id },
                    select: { id: true, name: true, business_email: true, credit_pool: true, frozen_credits: true, timezone: true },
                });

                if (!organization) throw new Error('Organization not found');


                const monthsCount = parseInt(months, 10);
                const creditsToAdd = SUBSCRIPTION_LIMITS[planType as PlanType]?.INITIAL_CREDITS || 0;
                const currentPool = Number(organization.credit_pool) || 0;
                const frozenCredits = Number(organization.frozen_credits) || 0;
                const newBalance = currentPool + creditsToAdd + frozenCredits;

                const amountInDollars = parseFloat((session.amount_total / 100).toFixed(2));
                const expiryDate = new Date();
                expiryDate.setMonth(expiryDate.getMonth() + monthsCount);

                // update subscription record
                await tx.subscription.update({
                    where: { org_id: org_id },
                    data: {
                        plan_name: planType,
                        payment_status: PaymentStatus.COMPLETED,
                        provider: PaymentProvider.STRIPE,
                        last_transaction_id: session.payment_intent,
                        start_date: new Date(),
                        end_date: expiryDate,
                        external_id: session.id,
                    }
                });

                // Create a new transaction record

                // Update organization's credit pool
                await tx.organizations.update({
                    where: { id: org_id },
                    data: {
                        credit_pool: newBalance,
                        frozen_credits: 0,
                        plan_type: planType,
                        isVerified: true,
                    }
                });

                // transaction log
                this.sharedService.createCreditTransaction(tx, {
                    orgId: org_id,
                    userId: userId,
                    amount: amountInDollars,
                    type: TransactionType.TOP_UP,
                    prevBalance: currentPool,
                    currBalance: newBalance,
                    payment_gateway: PaymentProvider.STRIPE,
                    transaction_id: session.payment_intent as string,
                    performedBy: userId,
                    price_paid: amountInDollars,
                    currency: currency,
                    status: PaymentStatus.COMPLETED,
                    description: `Subscription: ${planType} Plan (${monthsCount} months)`,
                })

                // activity log
                await this.sharedService.logActivity(tx, {
                    orgId: org_id,
                    userId: userId,
                    action: 'SUBSCRIPTION_CREATED',
                    details: `${planType} subscription activated. Credits: ${creditsToAdd}.`,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'] || '',
                    metadata: { planType, months: monthsCount, amount: amountInDollars }
                });

                // Send Notifications
                const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric'
                });
                const notificationMessage = `
                Hello ${organization.name},
                
                Great news! Your subscription to the ${planType} plan has been successfully activated for ${monthsCount} month(s). 
                
                Summary of your update:
                - Credits Added: ${creditsToAdd}
                - Credits Restored: ${frozenCredits}
                - Current Balance: ${newBalance} credits
                - Valid Until: ${formattedExpiry}
                
                Thank you for choosing Allocate. Your resources are now ready for management!
            `.trim();
                this.notificationManager.send({
                    orgId: org_id,
                    userId: userId,
                    userEmail: email,
                    userName: organization.name,
                    title: `Subscription Activated: ${planType} Plan`,
                    message: notificationMessage,
                    type: NotificationType.SUBSCRIPTION_RENEWED,
                    emailSubject: `🎉 Subscription Activated: ${planType} Plan`,

                });

                return { success: true, plan: planType };
            });

            return subscription;
        }

        if (event.type === 'checkout.session.async_payment_failed') {
            console.error(`❌ Payment failed for session ${session.id}`);
            // You can also update your subscription record to mark it as failed if needed

        }

        if (event.type === 'checkout.session.async_payment_succeeded') {
            console.log(`✅ Payment succeeded for session ${session.id}`);
            // You can also update your subscription record to mark it as successful if needed
        }

        if (event.type === 'checkout.session.async_payment_cancelled') {
            console.log(`❌ Payment cancelled for session ${session.id}`);
            // You can also update your subscription record to mark it as cancelled if needed
        }



        return { received: true };

    }
}