export interface EmailTemplate {
    subject: string;
    htmlContent: string;
}

interface BaseTemplateOptions {
    appName?: string;
    appUrl?: string;
    supportEmail?: string;
    metadata?: Record<string, any>;
}

interface WelcomeEmailOptions extends BaseTemplateOptions {
    name: string;
    email: string;

}

interface StaffInviteEmailOptions extends BaseTemplateOptions {
    staffName: string;
    staffEmail: string;
    tempPassword: string;
    webAppLink: string;
    organizationName?: string;
    invitedBy?: string;
}

interface ForgotPasswordEmailOptions extends BaseTemplateOptions {
    name: string;
    resetUrl: string;
    expiresInMinutes?: number;
}

interface VerifyOtpEmailOptions extends BaseTemplateOptions {
    name: string;
    otp: string;
    expiresInMinutes?: number;
}

interface VerifyEmailOptions extends BaseTemplateOptions {
    name: string;
    verifyUrl: string;
    expiresInMinutes?: number;
    email: string;
}

interface PasswordChangedOptions extends BaseTemplateOptions {
    name: string;
    changedAt?: string;
}

interface AccountLockedOptions extends BaseTemplateOptions {
    name: string;
    unlockAt?: string;
}

interface AnnouncementOptions extends BaseTemplateOptions {
    heading?: string;
    name: string;
    title: string;
    message: string;
    ctaLabel?: string;
    ctaUrl?: string;
}

const defaultTemplateOptions: Required<BaseTemplateOptions> = {
    appName: 'Allocate',
    appUrl: process.env.WEB_APP_LINK || '#',
    supportEmail: process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL || 'support@example.com',
    metadata: {},
};

const withDefaults = <T extends BaseTemplateOptions>(options: T): Required<BaseTemplateOptions> & T => ({
    ...defaultTemplateOptions,
    ...options,
});

// Simple HTML escaping to prevent injection in email templates
const escapeHtml = (value: string): string =>
    value?.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');

const buildLayout = (
    options: Required<BaseTemplateOptions>,
    heading: string,
    intro: string,
    bodyHtml: string,
): string => {
    return `
  <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#13202f;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7edf6;">
      <tr>
        <td style="padding:24px;background:linear-gradient(135deg,#173b7a,#2d7bbd);color:#ffffff;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;">${escapeHtml(options.appName)}</h1>
          <p style="margin:8px 0 0;font-size:13px;opacity:.9;color:#ffffff;">${escapeHtml(heading)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${intro}</p>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;background:#f9fbff;border-top:1px solid #e7edf6;font-size:12px;color:#5c6d82;">
          Need help? Contact <a href="mailto:${escapeHtml(options.supportEmail)}" style="color:#1d5fab;text-decoration:none;">${escapeHtml(options.supportEmail)}</a>
          <br/>
          <a href="${escapeHtml(options.appUrl)}" style="color:#1d5fab;text-decoration:none;">${escapeHtml(options.appUrl)}</a>
        </td>
      </tr>
    </table>
  </div>`;
};




export const buildWelcomeEmailTemplate = (rawOptions: WelcomeEmailOptions): EmailTemplate => {
    // Default values fallback
    const options = withDefaults(rawOptions);
    const appName = options.appName;
    const appUrl = options.appUrl;
    const credits = options.metadata?.initialCredits ?? 100;
    const orgText = options.metadata?.organizationName ? ` workspace for ${options.metadata.organizationName}` : '';

    const subject = `Welcome to ${appName}, ${rawOptions.name}! ✨`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Allocate</title>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;background-color:#f8fafc;color:#334155;-webkit-font-smoothing:antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f8fafc;">
            <tr>
                <td align="center" style="padding:40px 16px;">
                    <!-- Main Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px 0 rgba(0, 0, 0, 0.05);">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td align="left" style="padding:40px 40px 20px;background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
                                <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.025em;">
                                    ${escapeHtml(appName)}
                                </h1>
                                <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Workforce & Resource Optimization</p>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding:40px;">
                                <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#0f172a;letter-spacing:-0.025em;">
                                    Welcome aboard, ${escapeHtml(rawOptions.name)}! 👋
                                </h2>
                                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                                    Your account has been successfully initialized under the email <span style="font-family:monospace;background-color:#f1f5f9;padding:2px 6px;border-radius:4px;color:#0f172a;font-size:13px;">${escapeHtml(rawOptions.email)}</span>.${escapeHtml(orgText)}
                                </p>

                                <!-- Credit Balance Widget (Highlight Feature) -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                                    <tr>
                                        <td style="padding:16px 20px;">
                                            <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Available Booking Balance</div>
                                            <div style="margin:4px 0 0;font-size:24px;font-weight:700;color:#2563eb;">
                                                ${credits} <span style="font-size:14px;font-weight:500;color:#64748b;">Credits Allocated</span>
                                            </div>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Next Steps Checklist -->
                                <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">
                                    Quick Start Checklist
                                </h3>
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                                    <tr>
                                        <td valign="top" style="padding:6px 0;width:24px;font-size:14px;color:#2563eb;">✦</td>
                                        <td style="padding:6px 0;font-size:14px;color:#475569;"><strong>Complete Profile:</strong> Set your dynamic availability tags.</td>
                                    </tr>
                                    <tr>
                                        <td valign="top" style="padding:6px 0;width:24px;font-size:14px;color:#2563eb;">✦</td>
                                        <td style="padding:6px 0;font-size:14px;color:#475569;"><strong>Explore Resources:</strong> View available boardrooms, desks, or hardware assets.</td>
                                    </tr>
                                    <tr>
                                        <td valign="top" style="padding:6px 0;width:24px;font-size:14px;color:#2563eb;">✦</td>
                                        <td style="padding:6px 0;font-size:14px;color:#475569;"><strong>First Booking:</strong> Use your credits to lock down your first resource.</td>
                                    </tr>
                                </table>

                                <!-- CTA Button -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding-top:8px;">
                                            <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:14px 28px;border-radius:10px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;box-shadow:0 4px 6px -1px rgba(37, 99, 235, 0.2);transition:background-color 0.2s;">
                                                Go to Dashboard →
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                                    This is an automated operational email from ${escapeHtml(appName)} Systems.<br>
                                    If you did not request this account, please contact security team.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return { subject, htmlContent };
};

export const buildStaffInviteEmailTemplate = (rawOptions: StaffInviteEmailOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const subject = `You are invited to join ${rawOptions.organizationName || options.appName}`;

    const htmlContent = buildLayout(
        options,
        'Staff invitation',
        `Hi ${escapeHtml(rawOptions.staffName)}, you have been invited to join ${escapeHtml(rawOptions.organizationName || options.appName)}.`,
        `
      <p style="margin:0 0 8px;font-size:15px;line-height:1.7;">Use the credentials below to sign in:</p>
      <p style="margin:0 0 2px;font-size:14px;"><strong>Email:</strong> ${escapeHtml(rawOptions.staffEmail)}</p>
      <p style="margin:0 0 16px;font-size:14px;"><strong>Temporary password:</strong> ${escapeHtml(rawOptions.tempPassword)}</p>
      ${rawOptions.invitedBy ? `<p style="margin:0 0 14px;font-size:14px;">Invited by: ${escapeHtml(rawOptions.invitedBy)}</p>` : ''}
      <a href="${escapeHtml(rawOptions.webAppLink)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#173b7a;color:#ffffff;text-decoration:none;font-weight:600;">Open workspace</a>
      <p style="margin:14px 0 0;font-size:13px;color:#5c6d82;">For security, change your password after first login.</p>
    `,
    );

    return { subject, htmlContent };
};

export const buildForgotPasswordEmailTemplate = (rawOptions: ForgotPasswordEmailOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const expiresInMinutes = rawOptions.expiresInMinutes ?? 15;
    const subject = `Reset your ${options.appName} password`;

    const htmlContent = buildLayout(
        options,
        'Password reset request',
        `Hi ${escapeHtml(rawOptions.name)}, we received a request to reset your password.`,
        `
      <a href="${escapeHtml(rawOptions.resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#173b7a;color:#ffffff;text-decoration:none;font-weight:600;">Reset password</a>
      <p style="margin:14px 0 0;font-size:13px;color:#5c6d82;">This link expires in ${expiresInMinutes} minutes.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#5c6d82;">If you did not request this, you can safely ignore this email.</p>
    `,
    );

    return { subject, htmlContent };
};

export const buildVerifyOtpEmailTemplate = (rawOptions: VerifyOtpEmailOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const expiresInMinutes = rawOptions.expiresInMinutes ?? 5;
    const subject = `${options.appName} verification code`;

    const htmlContent = buildLayout(
        options,
        'Verify your action',
        `Hi ${escapeHtml(rawOptions.name)}, use this one-time code to continue:`,
        `
      <p style="margin:10px 0 12px;font-size:30px;font-weight:700;letter-spacing:8px;color:#173b7a;">${escapeHtml(rawOptions.otp)}</p>
      <p style="margin:0;font-size:13px;color:#5c6d82;">This code expires in ${expiresInMinutes} minutes.</p>
    `,
    );

    return { subject, htmlContent };
};

export const buildVerifyEmailTemplate = (rawOptions: VerifyEmailOptions): EmailTemplate => {
    const appName = rawOptions.appName || 'Allocate';
    const verifyUrl = rawOptions.verifyUrl;
    const expiresInMinutes = rawOptions.expiresInMinutes ?? 60;

    const subject = `Verify your ${appName} account 🔐`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your Email - Allocate</title>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;background-color:#f8fafc;color:#334155;-webkit-font-smoothing:antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f8fafc;">
            <tr>
                <td align="center" style="padding:40px 16px;">
                    <!-- Main Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:500px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px 0 rgba(0, 0, 0, 0.05);">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td align="left" style="padding:32px 32px 20px;background-color:#0f172a;">
                                <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.025em;">
                                    ${escapeHtml(appName)}
                                </h1>
                            </td>
                        </tr>

                        <!-- Body Content -->
                        <tr>
                            <td style="padding:32px;">
                                <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:-0.025em;">
                                    Verify your email address
                                </h2>
                                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
                                    Hi ${escapeHtml(rawOptions.name)}, thank you for signing up! Please click the secure button below to verify your email address <strong style="color:#0f172a;">${escapeHtml(rawOptions.email)}</strong> and fully activate your account.
                                </p>

                                <!-- CTA Button -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
                                    <tr>
                                        <td align="center">
                                            <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 28px;border-radius:10px;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;box-shadow:0 4px 6px -1px rgba(37, 99, 235, 0.2);transition:background-color 0.2s;">
                                                Verify Email Address
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Expiration Notice Widget -->
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;background-color:#fff7ed;border:1px solid #ffedd5;border-radius:8px;">
                                    <tr>
                                        <td style="padding:10px 14px;font-size:12px;color:#c2410c;line-height:1.4;">
                                            ⏱️ Security Notice: This verification link is strictly confidential and will expire in <strong>${expiresInMinutes} minutes</strong>.
                                        </td>
                                    </tr>
                                </table>

                                <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

                                <!-- Plain Text URL Fallback -->
                                <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.4;">
                                    If the button above isn't working, copy and paste this absolute link into your web browser:
                                </p>
                                <p style="margin:0;font-size:12px;word-break:break-all;line-height:1.4;">
                                    <a href="${escapeHtml(verifyUrl)}" style="color:#2563eb;text-decoration:underline;">
                                        ${escapeHtml(verifyUrl)}
                                    </a>
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
                                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
                                    If you did not attempt to register an account with ${escapeHtml(appName)}, you can safely ignore or delete this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return { subject, htmlContent };
};

export const buildPasswordChangedEmailTemplate = (rawOptions: PasswordChangedOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const changedAt = rawOptions.changedAt || new Date().toISOString();
    const subject = `${options.appName} password changed`;

    const htmlContent = buildLayout(
        options,
        'Password updated',
        `Hi ${escapeHtml(rawOptions.name)}, your password was changed successfully.`,
        `
      <p style="margin:0 0 10px;font-size:14px;">Changed at: ${escapeHtml(changedAt)}</p>
      <p style="margin:0;font-size:13px;color:#5c6d82;">If you did not perform this action, contact support immediately.</p>
    `,
    );

    return { subject, htmlContent };
};

export const buildAccountLockedEmailTemplate = (rawOptions: AccountLockedOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const subject = `${options.appName} account security alert`;

    const htmlContent = buildLayout(
        options,
        'Account temporarily locked',
        `Hi ${escapeHtml(rawOptions.name)}, your account has been temporarily locked due to multiple failed login attempts.`,
        `
      <p style="margin:0 0 10px;font-size:14px;">${rawOptions.unlockAt ? `Expected unlock time: ${escapeHtml(rawOptions.unlockAt)}` : 'Please wait a few minutes before trying again.'}</p>
      <p style="margin:0;font-size:13px;color:#5c6d82;">If this was not you, reset your password right away.</p>
    `,
    );

    return { subject, htmlContent };
};



export const buildAnnouncementEmailTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const subject = rawOptions.title;

    const htmlContent = buildLayout(
        options,
        rawOptions.heading || 'New announcement',
        `Hi ${escapeHtml(rawOptions.name)}, here is an update for you:`,
        `
      <h2 style="margin:0 0 10px;font-size:20px;color:#13202f;">${escapeHtml(rawOptions.title)}</h2>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.7;">${escapeHtml(rawOptions.message)}</p>
      ${rawOptions.ctaUrl ? `<a href="${escapeHtml(rawOptions.ctaUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#173b7a;color:#ffffff;text-decoration:none;font-weight:600;">${escapeHtml(rawOptions.ctaLabel || 'View update')}</a>` : ''}
    `,
    );

    return { subject, htmlContent };
};



export const buildUpgradePlanEmailTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const subject = `Boost your workflow with Pro Features! ✨`;
    const billingUrl = `${options.appUrl}/dashboard/billing`;
    const frozenCredits = options.metadata?.frozenCredits ?? 0;

    const htmlContent = buildLayout(
        options,
        'Upgrade to Pro Plan',
        `Elevate ${options?.metadata?.orgName} with Pro Features`,
        `
    <div style="text-align: center; padding: 10px 0;">
        <h1 style="color: #1a1a1a; font-size: 26px; margin-bottom: 10px;">Scale Your Organization Faster</h1>
        <p style="color: #666666; font-size: 16px;">Hi ${options.name}, move beyond the limits and unlock the full potential of <strong>${options?.metadata?.orgName}</strong>.</p>
    </div>

    ${frozenCredits > 0 ? `
    <div style="background-color: #fff4e5; border: 1px dashed #ff9800; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: center;">
        <span style="font-size: 18px;">❄️</span> 
        <strong style="color: #e65100;">You have ${frozenCredits} credits frozen!</strong><br/>
        <span style="font-size: 14px; color: #666;">Upgrade to Pro now to instantly unlock and use your remaining credits.</span>
    </div>
    ` : ''}

    <div style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; margin: 25px 0;">
        <div style="background-color: #173b7a; color: #ffffff; padding: 15px; text-align: center; font-weight: bold;">
            PRO PLAN BENEFITS
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="15" border="0">
            <tr>
                <td style="border-bottom: 1px solid #f0f0f0;">
                    <strong>📅 30-Day Booking Window</strong><br/>
                    <span style="font-size: 13px; color: #666;">Plan ahead! Move from 7 days to a full month of advanced booking.</span>
                </td>
                <td style="border-bottom: 1px solid #f0f0f0;">
                    <strong>👥 50 User Capacity</strong><br/>
                    <span style="font-size: 13px; color: #666;">Grow your team without limits (Up from only 5 users).</span>
                </td>
            </tr>
            <tr>
                <td style="border-bottom: 1px solid #f0f0f0;">
                    <strong>🏢 20 Managed Resources</strong><br/>
                    <span style="font-size: 13px; color: #666;">Manage 10x more resources compared to the Free plan.</span>
                </td>
                <td style="border-bottom: 1px solid #f0f0f0;">
                    <strong>💰 Advanced Credit Management</strong><br/>
                    <span style="font-size: 13px; color: #666;">Full UI to track transactions, staff credits, and usage history.</span>
                </td>
            </tr>
            <tr>
                <td style="border-bottom: 1px solid #f0f0f0;">
                    <strong>🗓️ Calendar Availability View</strong><br/>
                    <span style="font-size: 13px; color: #666;">Visualize resource availability at a glance with our premium calendar.</span>
                </td>
                <td style="border-bottom: 1px solid #f0f0f0;">
                    <strong>⚙️ Dynamic Resource Rules</strong><br/>
                    <span style="font-size: 13px; color: #666;">Update and customize booking rules for each resource on the fly.</span>
                </td>
            </tr>
            <tr>
                <td colspan="2" style="background-color: #f9f9f9; text-align: center;">
                    <strong>📈 Plus: Detailed Insights, Priority Support & Personal Staff Transaction History</strong>
                </td>
            </tr>
        </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${billingUrl}" 
           style="display:inline-block; padding:16px 35px; border-radius:8px; background:#173b7a; color:#ffffff; text-decoration:none; font-weight:bold; font-size: 18px;">
           Upgrade Now & Get 1,000 Credits
        </a>
        <p style="font-size: 13px; color: #888; margin-top: 15px;">
            Join other successful organizations using our Pro tools to streamline their operations.
        </p>
    </div>

    <div style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #777; font-size: 13px; line-height: 1.5;">
        <p>Questions? Reply to this email or contact our Priority Support team (available for Pro users).</p>
    </div>
    `
    );

    return { subject, htmlContent };
};

// reset credits email template
export const buildCreditResetEmailTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const subject = `Your ${options?.metadata?.orgName} credits have been refilled! 🚀`;
    const billingUrl = `${options.appUrl}/dashboard/billing`;

    // Metadata থেকে ডাটা নেওয়া
    const orgName = options?.metadata?.orgName || 'Your Organization';
    const newLimit = options?.metadata?.newCreditLimit || 100;
    const frozenCredits = options?.metadata?.frozenCredits || 0;

    const htmlContent = buildLayout(
        options,
        'Monthly Credits Refilled',
        `New month, new opportunities for ${orgName}!`,
        `
    <div style="text-align: center; padding: 10px 0;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 10px;">Your Credits are Ready!</h1>
        <p style="color: #666666; font-size: 16px;">Hi ${options.name}, we've just refilled your monthly credits. You're all set to manage your bookings and resources.</p>
    </div>

    <!-- Credit Status Card -->
    <div style="background-color: #f4f7fa; border-radius: 12px; padding: 25px; margin: 20px 0; border: 1px solid #e0e6ed; text-align: center;">
        <div style="color: #173b7a; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
            Current Balance
        </div>
        <div style="font-size: 48px; font-weight: 800; color: #173b7a; margin-bottom: 5px;">
            ${newLimit}
        </div>
        <div style="color: #5a7184; font-size: 14px;">
            Credits available for this month
        </div>
    </div>

    ${frozenCredits > 0 ? `
    <div style="background-color: #fff4e5; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; text-align: left;">
        <strong style="color: #e65100; font-size: 15px;">❄️ Important: You have ${frozenCredits} credits frozen</strong>
        <p style="margin: 5px 0 0; font-size: 13px; color: #666; line-height: 1.4;">
            Since you are on the Free Tier, your excess credits are locked. 
            <strong>Upgrade to Pro</strong> to unlock them and increase your monthly limit to 1,000!
        </p>
    </div>
    ` : ''}

    <div style="margin: 25px 0; text-align: center;">
        <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
            Don't let your resources sit idle. Use your credits to schedule appointments, manage staff, and streamline your operations.
        </p>
        
        <div style="margin-top: 30px;">
            <a href="${options.appUrl}/dashboard" 
               style="display:inline-block; padding:14px 30px; border-radius:8px; background:#173b7a; color:#ffffff; text-decoration:none; font-weight:bold; font-size: 16px; margin-right: 10px;">
                Go to Dashboard
            </a>
            
            <a href="${billingUrl}" 
               style="display:inline-block; padding:14px 30px; border-radius:8px; background:#ffffff; color:#173b7a; text-decoration:none; font-weight:bold; font-size: 16px; border: 2px solid #173b7a;">
                Upgrade Plan
            </a>
        </div>
    </div>

    <div style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999; font-size: 12px; text-align: center;">
        <p>This is an automated notification regarding your monthly credit reset policy.</p>
    </div>
    `
    );

    return { subject, htmlContent };
};

// Weekly report email template
export const buildWeeklyReportEmailTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const metadata = options.metadata || {};
    const reportData = metadata.stats || {};
    const orgName = metadata.orgName || 'Your Organization';
    const subject = `Weekly Activity Report: ${orgName} 📊`;

    const htmlContent = buildLayout(
        options,
        'Weekly Activity Summary',
        `Hi ${escapeHtml(rawOptions.name)}, here is a summary of your organization's performance for the last 7 days.`,
        `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
            
            <!-- Date Badge -->
            <div style="text-align: center; margin-bottom: 24px;">
                <span style="background-color: #f1f5f9; color: #64748b; padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Report Period: ${new Date().toLocaleDateString()} - Last 7 Days
                </span>
            </div>

            <!-- Dashboard Style Metrics -->
            <div style="display: table; width: 100%; border-spacing: 10px; margin-bottom: 20px;">
                <div style="display: table-row;">
                    <!-- Total Bookings Highlight -->
                    <div style="display: table-cell; width: 40%; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 16px; padding: 20px; color: #ffffff; vertical-align: top; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <p style="margin: 0; font-size: 12px; font-weight: 600; opacity: 0.9; text-transform: uppercase;">Total Bookings</p>
                        <h1 style="margin: 8px 0; font-size: 42px; font-weight: 800;">${reportData.totalBookings || 0}</h1>
                        <div style="background: rgba(255,255,255,0.2); display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px;">
                            Busiest: <strong>${reportData.busiestDay || 'N/A'}</strong>
                        </div>
                    </div>

                    <!-- Secondary Stats -->
                    <div style="display: table-cell; vertical-align: top;">
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 10px;">
                            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Top Resource</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">${reportData.topResourceName}</p>
                        </div>
                        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px;">
                            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Top Staff</p>
                            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">${reportData.topUserName}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Detail List Card -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 30px;">
                <div style="padding: 16px 20px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                    <h3 style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 700;">Performance Breakdown</h3>
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="15" border="0">
                    <tr>
                        <td style="font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9;">Credits Consumed</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${reportData.creditsUsed || 0} Credits</td>
                    </tr>
                    <tr>
                        <td style="font-size: 14px; color: #475569; border-bottom: 1px solid #f1f5f9;">Cancelled Bookings</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #ef4444; border-bottom: 1px solid #f1f5f9;">${reportData.cancelledBookings || 0} Bookings</td>
                    </tr>
                    <tr>
                        <td style="font-size: 14px; color: #475569;">Active Staff Count</td>
                        <td align="right" style="font-size: 14px; font-weight: 700; color: #0f172a;">${reportData.activeStaffCount || 0} Staff</td>
                    </tr>
                </table>
            </div>

            <!-- Footer Section -->
            <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                    This insights report is an exclusive benefit of your <strong>Pro Plan</strong>. <br/>
                    Visit your dashboard to view more insights and detailed logs.
                </p>
                <div style="margin-top: 20px; font-size: 11px; color: #cbd5e1;">
                    © ${new Date().getFullYear()} Allocate Inc. All rights reserved.
                </div>
            </div>
        </div>
        `
    );

    return { subject, htmlContent };
};

// Sales Inquery Thank You Template
export const buildSalesInquiryThankYouTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const subject = "Inquiry Received: We'll be in touch shortly";
    const userName = rawOptions.name || 'there';

    const appUrl = options.appUrl || '#';

    const htmlContent = buildLayout(
        options,
        'Thank You for Reaching Out',
        `Hi ${escapeHtml(userName)},`,
        `
      <!-- Intro -->
      <p style="margin:0 0 20px; font-size:16px; line-height:1.6; color:#334155;">
        We’ve successfully received your inquiry. Thank you for considering us as a potential partner for your business needs. 
      </p>

      <!-- Static Professional Message -->
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
        <p style="margin:0 0 12px; font-size:15px; line-height:1.6; color:#1e293b;">
          Our team is dedicated to providing tailored solutions that drive efficiency and growth. We understand that every requirement is unique, and we are already looking into how our expertise can best align with your goals.
        </p>
        <p style="margin:0; font-size:15px; line-height:1.6; color:#1e293b;">
          We pride ourselves on technical excellence and clear communication, ensuring that your vision is translated into a functional reality.
        </p>
      </div>

      <!-- Expectation Management -->
      <h3 style="margin:0 0 12px; font-size:18px; color:#173b7a; font-weight: 600;">What happens next?</h3>
      <p style="margin:0 0 25px; font-size:15px; line-height:1.6; color:#475569;">
        One of our solution specialists will carefully analyze your request. You can expect a detailed response or a follow-up invitation for a discovery call within <b>24 business hours</b>.
      </p>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${escapeHtml(appUrl)}" 
           style="display:inline-block; padding:14px 35px; border-radius:8px; background:#173b7a; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; letter-spacing: 0.5px;">
           Visit Our Website
        </a>
      </div>

      <!-- Footer-like Closing -->
      <div style="height: 1px; background: #e2e8f0; margin: 30px 0;"></div>
      
      <p style="margin:0; font-size:15px; line-height:1.6; color:#334155;">
        Best Regards,<br>
        <span style="color:#173b7a; font-weight:700;">Sales & Partnerships Team</span>
      </p>
      
      <p style="margin:10px 0 0; font-size:11px; color:#94a3b8; text-align: center;">
        This is an automated confirmation of receipt.
      </p>
    `,
    );
    return { subject, htmlContent };
};

// Sales Inquery Follow Up Template
export const buildSalesInqueryFollowUpTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const inquiry = options.metadata?.inquiry; // Accessing the object passed in your service
    const subject = `🔥 New Sales Lead: ${inquiry?.organization.name || 'Inquiry Received'}`;

    const htmlContent = buildLayout(
        options,
        'New Sales Inquiry', // Heading
        `A new business inquiry has been submitted. Details are below:`, // Sub-heading
        `
      <!-- Data Table -->
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 25px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
          <tr>
            <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600; width: 35%;">Name</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(inquiry?.name || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Business Email</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #173b7a; font-weight: 500;">${escapeHtml(inquiry?.business_email || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Phone</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(inquiry?.phone || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Team Size</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${inquiry?.team_size || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Country</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(inquiry?.country || 'N/A')}</td>
          </tr>
          ${inquiry?.organization ? `
          <tr>
            <td style="padding: 12px 16px; background: #f0f4ff; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Existing Org</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f0f4ff;">
                <strong>${escapeHtml(inquiry.organization.name)}</strong><br/>
                <span style="font-size: 12px; color: #64748b;">ID: ${inquiry.organization.id}</span>
            </td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Message Section -->
      <div style="margin-bottom: 25px;">
        <h4 style="margin: 0 0 8px; font-size: 14px; color: #173b7a; text-transform: uppercase; letter-spacing: 0.05em;">Client Message:</h4>
        <div style="padding: 16px; background: #f1f5f9; border-radius: 8px; color: #1e293b; line-height: 1.6; font-size: 15px; border-left: 4px solid #173b7a;">
          ${escapeHtml(inquiry?.message || 'No message provided.')}
        </div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.WEB_APP_LINK}/dashboard/sales" 
           style="display:inline-block; padding:14px 28px; border-radius:8px; background:#173b7a; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px;">
           Open Admin Dashboard
        </a>
      </div>
    `,
    );

    return { subject, htmlContent };
};

// Subscription activated email template
export const buildSubscriptionRenewedTemplate = (rawOptions: AnnouncementOptions): EmailTemplate => {
    const options = withDefaults(rawOptions);
    const metadata = options.metadata || {};

    // Extract metadata with fallbacks
    const plan = metadata.planType || 'Pro Plan';
    const amount = metadata.amount ? `$${metadata.amount}` : 'N/A';
    const expiry = metadata.expireDate || 'N/A';
    const credits = metadata.creditsToAdd || 0;
    const orgName = metadata.orgName || 'Your Organization';

    const subject = `Subscription Activated: ${plan} 🎉`;

    const htmlContent = buildLayout(
        options,
        'Subscription Activated',
        `Hi ${escapeHtml(rawOptions.name)}, your subscription for <strong>${escapeHtml(orgName)}</strong> has been successfully processed!`,
        `
        <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 16px; font-size: 18px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">Order Summary</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Plan Type</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(plan)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Duration</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${metadata.months} Month(s)</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Credits Added</td>
                    <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 600; text-align: right;">+${credits} Credits</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount Paid</td>
                    <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${amount}</td>
                </tr>
                <tr>
                    <td style="padding: 12px 0 0; color: #64748b; font-size: 14px; border-top: 1px dashed #cbd5e1;">Valid Until</td>
                    <td style="padding: 12px 0 0; color: #ef4444; font-size: 14px; font-weight: 600; text-align: right; border-top: 1px dashed #cbd5e1;">${escapeHtml(expiry)}</td>
                </tr>
            </table>
        </div>

        <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:#334155;">
            Your credits have been added to your organization balance. You can now continue managing your workforce and resources seamlessly.
        </p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(options.appUrl)}"
                style="display:inline-block; padding:14px 32px; border-radius:8px; background:#173b7a; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Go to Dashboard
            </a>
        </div>

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px;">
            <p style="margin:0; font-size:13px; color:#1e40af;">
                <strong>Pro Tip:</strong> You can view and download your full invoice from the Billing section of your dashboard.
            </p>
        </div>
        `
    );

    return { subject, htmlContent };
};