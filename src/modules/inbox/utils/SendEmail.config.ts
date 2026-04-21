import { BrevoClient } from '@getbrevo/brevo';
import { AppError } from 'src/errors/AppError';

// Type definitions
interface EmailRecipient {
    email: string;
    name?: string;
}

interface SendEmailOptions {
    to: EmailRecipient | EmailRecipient[];
    cc?: EmailRecipient[];
    bcc?: EmailRecipient[];
    subject: string;
    htmlContent: string;
    textContent?: string;
    replyTo?: EmailRecipient;
    tags?: string[];
    templateId?: number;
    params?: Record<string, any>;
    attachment?: Array<{
        content: Buffer;
        name: string;
        type?: string;
    }>;
}

// Email Configuration
class EmailConfig {
    private brevoClient: BrevoClient;
    private senderName: string;
    private senderEmail: string;

    constructor() {
        this.validateEnvironment();
        this.brevoClient = new BrevoClient({
            apiKey: process.env.BREVO_API_KEY!,
        });
        this.senderName = process.env.SENDER_NAME || 'Allocate Team';
        this.senderEmail = process.env.SENDER_EMAIL!;
    }

    private validateEnvironment(): void {
        const requiredEnvVars = ['BREVO_API_KEY', 'SENDER_EMAIL'];
        const missing = requiredEnvVars.filter(
            (envVar) => !process.env[envVar],
        );

        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missing.join(', ')}`
            );
        }

        // Validate API key format (should not be placeholder)
        if (process.env.BREVO_API_KEY?.includes('your_') || 
            process.env.BREVO_API_KEY === 'placeholder') {
            throw new Error(
                'BREVO_API_KEY is not configured. Please set a valid API key in your .env file'
            );
        }
    }

    private normalizeRecipients(
        recipients: EmailRecipient | EmailRecipient[],
    ): EmailRecipient[] {
        return Array.isArray(recipients) ? recipients : [recipients];
    }

    async sendEmail(options: SendEmailOptions): Promise<any> {
        try {
            const emailPayload: Record<string, any> = {
                subject: options.subject,
                htmlContent: options.htmlContent,
                textContent: options.textContent,
                sender: {
                    name: this.senderName,
                    email: this.senderEmail,
                },
                to: this.normalizeRecipients(options.to),
                cc: options.cc,
                bcc: options.bcc,
                replyTo: options.replyTo,
                tags: options.tags,
            };

            // Add template ID if provided
            if (options.templateId) {
                emailPayload.templateId = options.templateId;
                emailPayload.params = options.params;
                delete emailPayload.htmlContent;
            }

            // Add attachments if provided
            if (options.attachment && options.attachment.length > 0) {
                emailPayload.attachment = options.attachment.map((att) => ({
                    content: att.content.toString('base64'),
                    name: att.name,
                    type: att.type || 'application/octet-stream',
                }));
            }

            const response = await this.brevoClient.transactionalEmails.sendTransacEmail(
                emailPayload,
            );
            return {
                success: true,
                messageId: response?.messageId,
                data: response,
            };
        } catch (error: any) {
            const errorMessage =
                error.message ||
                'Failed to send email';
            const statusCode = error.status || 500;
            
            console.error('Brevo Email Error:', {
                message: errorMessage,
                status: statusCode,
                details: error.error,
            });

            throw new AppError(
                `Email Error: ${errorMessage}`,
                statusCode,
            );
        }
    }
}

// Singleton instance
let emailConfigInstance: EmailConfig;

const getEmailConfig = (): EmailConfig => {
    if (!emailConfigInstance) {
        emailConfigInstance = new EmailConfig();
    }
    return emailConfigInstance;
};

// Helper function for simple emails
const sendEmailTo = async (
    userEmail: string,
    userName: string,
    subject: string,
    htmlContent: string,
): Promise<any> => {
    const emailConfig = getEmailConfig();
    return emailConfig.sendEmail({
        to: { email: userEmail, name: userName },
        subject,
        htmlContent,
    });
};

export { EmailConfig, getEmailConfig, sendEmailTo };
export type { SendEmailOptions, EmailRecipient };
