import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCheckoutDto } from './payments.dto';
import { CurrentUserType } from 'src/shared/decorators/user.decorator';
import { FREE_TRIAL_DAYS, SUBSCRIPTION_LIMITS, SUBSCRIPTION_PRICING } from 'src/shared/constant/subscription.constant';
import { NotificationType, PaymentProvider, PaymentStatus, PlanType, Role, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
const Stripe = require('stripe');
const SSLCommerzPayment = require('sslcommerz-lts')
import { env } from 'src/shared/config/env';
import { Request } from 'express';
import { SharedService } from 'src/shared/services/shared.service';
import { NotificationManager } from '../inbox/service/notification-manager.service';
import { fail } from 'assert';
import { isValid } from 'zod/v3';
import { sslCommerzConfig } from 'src/shared/config/ssl-commerz';
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
            cancel_url: `${env.WEB_APP_LINK}/dashboard/billing?payment=cancelled`,
            // fail_url: `${env.WEB_APP_LINK}/dashboard/billing?payment=failed`,
        });

        return { url: session.url };
    }


    // Handle Stripe webhook for payment events
    async handleStripeWebhook(signature: string, req: any) {
        let event;

        try {
            // parse the request body
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


                const monthsCount = parseInt(months, 10) || 1;
                const creditsToAdd = SUBSCRIPTION_LIMITS[planType as PlanType]?.INITIAL_CREDITS || 0;
                const currentPool = Number(organization.credit_pool) || 0;
                const frozenCredits = Number(organization.frozen_credits) || 0;
                const newBalance = currentPool + creditsToAdd + frozenCredits;

                const amountInDollars = parseFloat((session.amount_total / 100).toFixed(2));


                const currentSub = await tx.subscription.findUnique({
                    where: { org_id: org_id },
                    select: { end_date: true, plan_name: true }
                });


                let newExpiryDate = new Date();
                const isSamePlan = currentSub?.plan_name === planType;
                const currentEndDate = currentSub?.end_date ? new Date(currentSub.end_date) : null;
                const isStillActive = currentEndDate && currentEndDate > new Date();
                // Check if there's an active subscription and adjust the start and end dates accordingly
                if (isSamePlan && isStillActive) {
                    newExpiryDate = new Date(currentEndDate);
                } else {
                    newExpiryDate = new Date();
                }
                newExpiryDate.setMonth(newExpiryDate.getMonth() + monthsCount);

                const paymentIntentId = typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.id;

                // update subscription record
                await tx.subscription.update({
                    where: { org_id: org_id },
                    data: {
                        plan_name: planType,
                        payment_status: PaymentStatus.COMPLETED,
                        provider: PaymentProvider.STRIPE,
                        last_transaction_id: paymentIntentId,
                        start_date: new Date(),
                        end_date: newExpiryDate,
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
                        isTrialAllowed: false,
                        hasUsedTrial: true,
                        trialStartAt: null,
                        trialEndsAt: null,

                    }
                });

                // transaction log
                await this.sharedService.createCreditTransaction(tx, {
                    orgId: org_id,
                    userId: userId,
                    amount: creditsToAdd,
                    type: TransactionType.TOP_UP,
                    prevBalance: currentPool,
                    currBalance: newBalance,
                    payment_gateway: PaymentProvider.STRIPE,
                    transaction_id: paymentIntentId,
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
                const formattedExpiry = newExpiryDate.toLocaleDateString('en-US', {
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
                    emailTemplateId: 'subscription_renewed', // Assuming you have this template set up in your email service
                    metadata: {
                        planType,
                        months: monthsCount,
                        amount: amountInDollars,
                        expireDate: formattedExpiry,
                        creditsToAdd,
                        frozenCredits,
                        newBalance,
                        orgName: organization.name
                    }

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


    // Create a SSLCOMMERZ checkout session (if you want to implement it in the future)
    async createSSLCOMMERZSession(dto: CreateCheckoutDto, user: CurrentUserType) {
        // Implement SSLCOMMERZ session creation logic here
        const transactionId = `SSLC_${Date.now()}_${user.id.slice(-5)}`;
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

        // get orgnization info 
        const organization = await this.prisma.organizations.findFirst({
            where: { id: user.org_id },
            select: { address: true, id: true, name: true },
        })
        const orgAddress = organization?.address as any;
        const data = {

            total_amount: totalAmount, // Adjust if you want to convert to BDT
            currency: 'BDT',
            tran_id: transactionId,
            success_url: `${env.WEB_APP_LINK}/payment?payment=success&tran_id=${transactionId}`,
            fail_url: `${env.WEB_APP_LINK}/payment?payment=fail`,
            cancel_url: `${env.WEB_APP_LINK}/payment?payment=cancel`,
            ipn_url: `${env.BACKEND_URL}/payments/ssl-webhook`, // IPN Endpoint
            shipping_method: 'No',
            product_name: `Allocate ${planType} Plan Subscription`,
            product_category: 'Software',
            product_profile: 'general',
            cus_name: user?.name,
            cus_email: user?.email,
            cus_add1: orgAddress?.line2 + ' ' + orgAddress?.city,
            cus_country: orgAddress?.country,
            cus_phone: '01700000000',
            value_a: organization?.id,
            value_b: planType,
            value_c: months.toString(),
            value_d: currency,

        };


        const { isLive, store_id, store_password } = sslCommerzConfig('sandbox');
        const sslcz = new SSLCommerzPayment(store_id, store_password, isLive)
        try {

            const apiResponse = await sslcz.init(data);
            if (apiResponse?.GatewayPageURL) {
                return { url: apiResponse.GatewayPageURL };
            } else {
                // If GatewayPageURL is not present, throw an error with the failed reason from the API response
                throw new Error(apiResponse?.failedreason || 'SSLCommerz initialization failed');
            }
        } catch (error) {
            console.error('SSLCommerz Error:', error);
            throw new Error('Payment initialization failed');
        }


    }


    // Handle SSLCommerz IPN (Instant Payment Notification)
    async handleSSLIPN(body: any, req: Request) {
        // console.log('Handling SSLCommerz IPN:', body);
        // Implement logic to handle SSLCommerz IPN events here
        const { tran_id, status, val_id, amount, value_a, value_b, value_c, value_d } = body;
        const org_id = value_a;
        const planType = value_b as PlanType;
        const months = value_c;
        const currency = value_d;

        // Test validation of the payment using val_id
        const { isValid } = await this.validateSSLPayment(val_id);
        if (!isValid) {
            console.error('Payment validation failed');
            return { received: false, error: 'Payment validation failed' };
        }

        // Check if the session has already been processed to ensure idempotency
        const existingSession = await this.prisma.subscription.findFirst({
            where: {
                external_id: val_id,
                payment_status: PaymentStatus.COMPLETED
            }
        });

        if (existingSession) {
            console.log(`⚠️ Session ${val_id} already processed. Skipping...`);
            return { received: true, error: 'Session already processed' };
        }


        const result = await this.prisma.$transaction(async (tx) => {

            const organization = await tx.organizations.findFirst({
                where: { id: org_id },
                select: {
                    id: true, name: true, business_email: true, credit_pool: true, frozen_credits: true, timezone: true,
                    users: {
                        where: {
                            role: Role.ORG_ADMIN
                        },
                        select: { email: true, id: true }
                    }
                },
            });
            if (!organization) {
                throw new NotFoundException('Organization not found');
            }

            const userId = organization?.users?.[0]?.id; // Assuming the org admin is performing the transaction. Adjust if you have a different logic to determine the user.
            const email = organization?.users?.[0]?.email;
            const monthsCount = parseInt(months, 10) || 1;
            const creditsToAdd = SUBSCRIPTION_LIMITS[planType as PlanType]?.INITIAL_CREDITS || 0;
            const currentPool = Number(organization?.credit_pool) || 0;
            const frozenCredits = Number(organization?.frozen_credits) || 0;
            const newBalance = currentPool + creditsToAdd + frozenCredits;

            const amountInTaka = parseFloat(amount);
            const amountInDollars = await this.convertBDTtoUSD(amountInTaka); // Assuming amount is in BDT and converting to USD for record


            const currentSub = await tx.subscription.findUnique({
                where: { org_id: org_id },
                select: { end_date: true, plan_name: true }
            });


            let newExpiryDate = new Date();
            const isSamePlan = currentSub?.plan_name === planType;
            const currentEndDate = currentSub?.end_date ? new Date(currentSub?.end_date) : null;
            const isStillActive = currentEndDate && currentEndDate > new Date();
            // Check if there's an active subscription and adjust the start and end dates accordingly
            if (isSamePlan && isStillActive) {
                newExpiryDate = new Date(currentEndDate);
            } else {
                newExpiryDate = new Date();
            }
            newExpiryDate.setMonth(newExpiryDate.getMonth() + monthsCount);


            // update subscription record
            await tx.subscription.update({
                where: { org_id: org_id },
                data: {
                    plan_name: planType,
                    payment_status: PaymentStatus.COMPLETED,
                    provider: PaymentProvider.SSLCOMMERZ,
                    last_transaction_id: tran_id,
                    start_date: new Date(),
                    end_date: newExpiryDate,
                    external_id: val_id,
                }
            });


            // Update organization's credit pool
            await tx.organizations.update({
                where: { id: org_id },
                data: {
                    credit_pool: newBalance,
                    frozen_credits: 0,
                    plan_type: planType,
                    isVerified: true,
                    isTrialAllowed: false,
                    hasUsedTrial: true,
                    trialStartAt: null,
                    trialEndsAt: null,
                }
            });

            // transaction log
            await this.sharedService.createCreditTransaction(tx, {
                orgId: org_id,
                userId: userId,
                amount: creditsToAdd,
                type: TransactionType.TOP_UP,
                prevBalance: currentPool,
                currBalance: newBalance,
                payment_gateway: PaymentProvider.SSLCOMMERZ,
                transaction_id: tran_id,
                performedBy: userId,
                price_paid: amountInDollars,
                currency: 'USD',
                status: PaymentStatus.COMPLETED,
                description: `Subscription: ${planType} Plan (${monthsCount} months)`,
                metadata: {
                    planType,
                    months: monthsCount,
                    amountInTaka,
                    amountInDollars,
                    bank_tran_id: body.bank_tran_id,
                    card_type: body.card_type,
                    card_no: body.card_no,
                    card_issuer: body.card_issuer,
                    card_brand: body.card_brand,
                    currency,
                }
            })

            // activity log
            await this.sharedService.logActivity(tx, {
                orgId: org_id,
                userId: userId,
                action: 'SUBSCRIPTION_CREATED',
                details: `${planType} subscription activated. Credits: ${creditsToAdd}.`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] || '',
                metadata: {
                    planType,
                    months: monthsCount,
                    amountInTaka,
                    amountInDollars,
                    bank_tran_id: body.bank_tran_id,
                    card_type: body.card_type,
                    card_no: body.card_no,
                    card_issuer: body.card_issuer,
                    card_brand: body.card_brand,
                    currency
                }
            });

            // Send Notifications
            const formattedExpiry = newExpiryDate.toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
            });
            const notificationMessage = `
                Hello ${organization?.name},

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
                userName: organization?.name || 'User',
                title: `Subscription Activated: ${planType} Plan`,
                message: notificationMessage,
                type: NotificationType.SUBSCRIPTION_RENEWED,
                emailSubject: `🎉 Subscription Activated: ${planType} Plan`,
                emailTemplateId: 'subscription_renewed', // Assuming you have this template set up in your email service
                metadata: {
                    planType,
                    months: monthsCount,
                    amount: amountInDollars,
                    expireDate: formattedExpiry,
                    creditsToAdd,
                    frozenCredits,
                    newBalance,
                    orgName: organization?.name || 'User'
                }

            });

            return { success: true, plan: planType };
        });

        // const isValid = await this.validateSSLPayment(val_id);
        return { received: true };
    }


    async validateSSLPayment(val_id: string): Promise<{ isValid: boolean; validationData: any }> {
        if (!val_id) return { isValid: false, validationData: null };
        const { validationApiUrl, store_id, store_password } = sslCommerzConfig('sandbox');
        const validationUrl = validationApiUrl;
        const params = new URLSearchParams({
            val_id: val_id,
            store_id: store_id,
            store_passwd: store_password,
            format: 'json'
        });

        try {
            const response = await fetch(`${validationUrl}?${params.toString()}`, {
                method: 'GET',
            });

            if (!response.ok) {
                console.error('SSLCOMMERZ Validation API Error:', response.statusText);
                return { isValid: false, validationData: null };
            }

            const data = await response.json();
            const status = data?.status?.toUpperCase();
            return {
                isValid: status === 'VALID' || status === 'VALIDATED',
                validationData: data
            };

        } catch (error) {
            console.error('SSLCOMMERZ Validation Network Error:', error);
            return { isValid: false, validationData: null };
        }
    }

    async convertBDTtoUSD(amountInBDT: number | string): Promise<number> {
        const amount = typeof amountInBDT === 'string' ? parseFloat(amountInBDT) : amountInBDT;

        if (isNaN(amount) || amount <= 0) return 0;

        try {
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await response.json();
            if (data?.result === 'success') {
                const rate = data?.rates?.BDT || 120;
                const convertedAmount = parseFloat((amount / rate).toFixed(2));
                return convertedAmount;
            }
            return parseFloat((amount / 120).toFixed(2));
        } catch (error) {
            return parseFloat((amount / 120).toFixed(2));
        }
    }


    // Service method to activate trial subscription for an organization
    async activateTrial(user: CurrentUserType) {
        const orgId = user.org_id;


        const result = await this.prisma.$transaction(async (tx) => {
            const organization = await tx.organizations.findUnique({
                where: { id: orgId },
                select: {
                    id: true,
                    name: true,
                    business_email: true,
                    credit_pool: true,
                    frozen_credits: true,
                    timezone: true,
                    isTrialAllowed: true,
                    trialStartAt: true,
                    trialEndsAt: true,
                    hasUsedTrial: true,
                    users: {
                        where: {
                            role: Role.ORG_ADMIN
                        },
                        select: { email: true, id: true, name: true }
                    }
                },
            });

            if (!organization) throw new NotFoundException('Organization not found');
            if (!organization.isTrialAllowed) throw new BadRequestException('Trial activation is not allowed');
            if (organization.hasUsedTrial) throw new BadRequestException('Trial has already been used');


            const { credit_pool, frozen_credits, } = organization;
            const orgAdmin = organization.users?.[0];
            const trialCredits = SUBSCRIPTION_LIMITS[PlanType.TRIAL]?.INITIAL_CREDITS || 0;
            const newBalance = (Number(credit_pool) || 0) + trialCredits;
            const orgTimezone = organization.timezone || 'UTC';

            let trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + FREE_TRIAL_DAYS);

            if (organization?.trialEndsAt) {
                const adminSetDate = new Date(organization?.trialEndsAt);

                if (adminSetDate > new Date()) {
                    trialEndDate = adminSetDate;
                }
            }

            const now = new Date();
            const diffInTime = trialEndDate.getTime() - now.getTime();
            const dayDiff = Math.ceil(diffInTime / (1000 * 3600 * 24)); // in days

            const formattedDate = trialEndDate.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: orgTimezone,
            });

            // Update organization's subscription to trial
            await tx.subscription.update({
                where: { org_id: orgId },
                data: {
                    plan_name: PlanType.PRO,
                    is_active: true,
                    start_date: new Date(),
                    end_date: trialEndDate,
                    payment_status: PlanType.TRIAL,

                }
            });

            // Update organization's credit pool and frozen credits
            await tx.organizations.update({
                where: { id: orgId },
                data: {
                    plan_type: PlanType.PRO,
                    credit_pool: newBalance,
                    frozen_credits: frozen_credits,
                    hasUsedTrial: true,
                    trialStartAt: new Date(),
                    trialEndsAt: trialEndDate
                }
            })


            const detailMessage = `Your ${dayDiff}-day PRO trial is now active! 🚀 You have received ${trialCredits} credits and full access to all premium features until ${formattedDate}. Enjoy scaling your organization!`;

            // activity log
            await this.sharedService.logActivity(tx, {
                orgId,
                userId: user.id,
                action: 'TRIAL_ACTIVATED',
                details: detailMessage,
                ipAddress: '',
                userAgent: '',
                metadata: {
                    planType: PlanType.PRO,
                    trialEndDate: trialEndDate.toISOString(),
                    trialCredits
                }
            });

            // Credit transaction log
            await this.sharedService.createCreditTransaction(tx, {
                orgId,
                userId: user.id,
                amount: trialCredits,
                type: TransactionType.FREE_ALLOCATION,
                prevBalance: Number(credit_pool) || 0,
                currBalance: newBalance,
                description: `Trial activation bonus: ${trialCredits} credits added for 7-day PRO trial.`,
                performedBy: user.id,
                metadata: {
                    plan_type: PlanType.PRO,
                    activated_by: user.id
                }
            });

            // Send notification
            await this.notificationManager.send({
                userId: user.id,
                orgId,
                type: NotificationType.TRIAL_ACTIVATED,
                title: '🚀 PRO Trial Activated!',
                message: detailMessage,
                userEmail: orgAdmin?.email,
                userName: orgAdmin?.name,
                emailSubject: `Welcome to your PRO Trial - ${dayDiff} Days of Premium Access`,
            });
            return {
                success: true,
                message: 'Trial subscription activated successfully.',
                data: null
            };

        });

        return result;

    }

}