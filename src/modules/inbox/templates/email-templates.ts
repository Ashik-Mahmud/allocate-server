export interface EmailTemplate {
    subject: string;
    htmlContent: string;
}

interface BaseTemplateOptions {
    appName?: string;
    appUrl?: string;
    supportEmail?: string;
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
    appUrl: process.env.WEB_APP_URL || '#',
    supportEmail: process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL || 'support@example.com',
};

const withDefaults = <T extends BaseTemplateOptions>(options: T): Required<BaseTemplateOptions> & T => ({
    ...defaultTemplateOptions,
    ...options,
});

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
    const options = withDefaults(rawOptions);
    const subject = `Welcome to ${options.appName}, ${rawOptions.name}`;

    const htmlContent = buildLayout(
        options,
        'Welcome aboard',
        `Hi ${escapeHtml(rawOptions.name)}, welcome to ${escapeHtml(options.appName)}.`,
        `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">Your account has been set up with email <strong>${escapeHtml(rawOptions.email)}</strong>.</p>
      <a href="${escapeHtml(options.appUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#173b7a;color:#ffffff;text-decoration:none;font-weight:600;">Open ${escapeHtml(options.appName)}</a>
    `,
    );

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
    const options = withDefaults(rawOptions);
    const subject = `Verify your ${options.appName} email`;

    const htmlContent = buildLayout(
        options,
        'Email verification',
        `Hi ${escapeHtml(rawOptions.name)}, please verify your email to activate your account.`,
        `
      <a href="${escapeHtml(rawOptions.verifyUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#173b7a;color:#ffffff;text-decoration:none;font-weight:600;">Verify email</a>
        <p style="margin:14px 0 0;font-size:13px;color:#5c6d82;">This link expires in ${rawOptions.expiresInMinutes ?? 60} minutes.</p>
    `,
    );

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


