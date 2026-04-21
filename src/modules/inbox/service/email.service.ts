import { Injectable } from "@nestjs/common";
import { sendEmailTo } from "../utils/SendEmail.config";

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
}