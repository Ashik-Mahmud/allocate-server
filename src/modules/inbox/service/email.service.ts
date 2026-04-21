import { Injectable } from "@nestjs/common";
import { sendEmailTo } from "../utils/SendEmail.config";
import {
    buildAnnouncementEmailTemplate,
    buildForgotPasswordEmailTemplate,
    buildStaffInviteEmailTemplate,
    buildVerifyEmailTemplate,
    buildVerifyOtpEmailTemplate,
    buildWelcomeEmailTemplate,
    type EmailTemplate,
} from "../templates";

// Write Email service code
@Injectable()
export class EmailService {
    constructor() {
        // Initialize any necessary properties or dependencies here
    }

    // Method to send email
    async sendEmail(to: string, subject: string, body: string, userName?: string,) {
        // Implement logic to send email using an email service provider (e.g., SendGrid, AWS SES, etc.)
        // You can use the SMTP_API_KEY and other email configurations from the environment variables
        console.log(`Sending email to: ${to}, Subject: ${subject}, `);
        // Simulate email sending
        await sendEmailTo(to, (userName || to), subject, body);
        return { success: true, message: 'Email sent successfully' };
    }

    async sendTemplateEmail(to: string, userName: string, template: EmailTemplate) {
        await sendEmailTo(to, userName, template.subject, template.htmlContent);
        return { success: true, message: 'Email sent successfully' };
    }

    async sendWelcomeEmail(to: string, name: string) {
        const template = buildWelcomeEmailTemplate({ name, email: to });
        return this.sendTemplateEmail(to, name, template);
    }

    async sendStaffInviteEmail(options: {
        to: string;
        staffName: string;
        tempPassword: string;
        webAppLink: string;
        organizationName?: string;
        invitedBy?: string;
    }) {
        const template = buildStaffInviteEmailTemplate({
            staffName: options.staffName,
            staffEmail: options.to,
            tempPassword: options.tempPassword,
            webAppLink: options.webAppLink,
            organizationName: options.organizationName,
            invitedBy: options.invitedBy,
        });

        return this.sendTemplateEmail(options.to, options.staffName, template);
    }

    async sendUpdateStaffProfileInfoByOrganizationEmail(to: string, name: string, updatedFields: string[]) {
        const template = buildAnnouncementEmailTemplate({
            name,
            heading: 'Profile Updated',
            title: 'Your profile information has been updated',
            message: `Your profile information has been updated with the following changes: ${updatedFields.join(', ')}. If you did not make these changes, please contact your administrator immediately.`,
            ctaUrl: process.env.WEB_APP_LINK || 'http://localhost:3000',
            ctaLabel: 'Review Your Profile',
        });

        return this.sendTemplateEmail(to, name, template);
    }

    async sendForgotPasswordEmail(to: string, name: string, resetUrl: string, expiresInMinutes?: number) {
        const template = buildForgotPasswordEmailTemplate({
            name,
            resetUrl,
            expiresInMinutes,
        });

        return this.sendTemplateEmail(to, name, template);
    }

    async sendOtpEmail(to: string, name: string, otp: string, expiresInMinutes?: number) {
        const template = buildVerifyOtpEmailTemplate({
            name,
            otp,
            expiresInMinutes,
        });

        return this.sendTemplateEmail(to, name, template);
    }

    async sendVerifyEmail(to: string, name: string, verifyUrl: string, expiresInMinutes?: number) {
        const template = buildVerifyEmailTemplate({
            name,
            verifyUrl,
            expiresInMinutes,
        });

        return this.sendTemplateEmail(to, name, template);
    }

    async sendAnnouncementEmail(to: string, name: string, title: string, message: string, ctaUrl?: string, ctaLabel?: string) {
        const template = buildAnnouncementEmailTemplate({
            name,
            title,
            message,
            ctaUrl,
            ctaLabel,
        });

        return this.sendTemplateEmail(to, name, template);
    }

    // Send email to assign credits to staff member
    async sendCreditAssignmentEmail(to: string, name: string, credits: number, organizationName: string) {
        const template = buildAnnouncementEmailTemplate({
            name,
            heading: 'Credits Assigned',
            title: `You have been assigned ${credits} credits`,
            message: `You have been assigned ${credits} credits in the organization ${organizationName}. You can use these credits to book resources. If you have any questions, please contact your administrator.`,
            ctaUrl: process.env.WEB_APP_LINK || 'http://localhost:3000',
            ctaLabel: 'View Your Credits',
        });

        return this.sendTemplateEmail(to, name, template);
    }
}