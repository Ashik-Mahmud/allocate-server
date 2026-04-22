import { NotificationType } from '@prisma/client';

/**
 * Notification Preferences stored in organization settings
 */
export interface NotificationPreferences {
  email?: boolean;
  inApp?: boolean;
  sms?: boolean;
  push?: boolean;
}

/**
 * Unified notification data structure
 * Pass this to the dispatcher and it handles all channels
 */
export interface NotificationPayload {
  userId: string;
  orgId: string;
  userEmail: string;
  userName: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string; // e.g., Booking ID, Transaction ID
  metadata?: Record<string, any>;
  // Channel-specific templates (optional)
  emailSubject?: string;
  emailTemplate?: string; // HTML email template
  smsContent?: string; // Plain text for SMS
  pushTitle?: string;
  pushBody?: string;
}

/**
 * Response from notification dispatcher
 */
export interface NotificationDispatchResult {
  inApp: { sent: boolean; id?: string; error?: string };
  email: { sent: boolean; id?: string; error?: string };
  sms: { sent: boolean; id?: string; error?: string };
  push: { sent: boolean; id?: string; error?: string };
}

/**
 * Notification Dispatcher
 * Central hub for sending notifications through multiple channels
 * based on organization preferences
 *
 * Usage:
 * const result = await notificationDispatcher.dispatch({
 *   userId: 'user-123',
 *   orgId: 'org-456',
 *   userEmail: 'user@example.com',
 *   userName: 'John',
 *   type: 'BOOKING_CONFIRMED',
 *   title: 'Booking Confirmed',
 *   message: 'Your booking has been confirmed',
 *   emailSubject: 'Your Booking is Confirmed'
 * }, orgPreferences);
 */
export class NotificationDispatcher {
  /**
   * Main dispatch method - routes notification to all enabled channels
   */
  static async dispatch(
    payload: NotificationPayload,
    preferences: NotificationPreferences,
    services: {
      inboxService?: any;
      emailService?: any;
      smsService?: any;
      pushService?: any;
    },
  ): Promise<NotificationDispatchResult> {
    const result: NotificationDispatchResult = {
      inApp: { sent: false },
      email: { sent: false },
      sms: { sent: false },
      push: { sent: false },
    };

    try {
      // Send In-App Notification (usually always send)
      if (preferences.inApp !== false) {
        result.inApp = await this.sendInApp(payload, services.inboxService);
      }

      // Send Email
      if (preferences.email === true) {
        result.email = await this.sendEmail(payload, services.emailService);
      }

      // Send SMS (future)
      if (preferences.sms === true) {
        result.sms = await this.sendSMS(payload, services.smsService);
      }

      // Send Push Notification (future)
      if (preferences.push === true) {
        result.push = await this.sendPush(payload, services.pushService);
      }
    } catch (error) {
      console.error('Error in notification dispatch:', error);
    }

    return result;
  }

  /**
   * Send in-app notification (to database)
   */
  private static async sendInApp(
    payload: NotificationPayload,
    inboxService: any,
  ): Promise<{ sent: boolean; id?: string; error?: string }> {
    try {
      if (!inboxService) {
        return { sent: false, error: 'InboxService not provided' };
      }

      const notification = await inboxService.createNotification({
        userId: payload.userId,
        orgId: payload.orgId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        refId: payload.referenceId,
        metadata: payload.metadata,
      });

      return { sent: true, id: notification.id };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmail(
    payload: NotificationPayload,
    emailService: any,
  ): Promise<{ sent: boolean; id?: string; error?: string }> {
    try {
      if (!emailService) {
        return { sent: false, error: 'EmailService not provided' };
      }

      const subject = payload.emailSubject || payload.title;
      const body = payload.emailTemplate || payload.message;

      const result = await emailService.sendEmail(
        payload.userEmail,
        subject,
        body,
        payload.userName,
      );

      return {
        sent: result.success || true,
        id: `email_${Date.now()}`,
      };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  /**
   * Send SMS notification (placeholder for future integration)
   */
  private static async sendSMS(
    payload: NotificationPayload,
    smsService: any,
  ): Promise<{ sent: boolean; id?: string; error?: string }> {
    try {
      if (!smsService) {
        return { sent: false, error: 'SMS service not configured' };
      }

      // When SMS service is ready, implement here
      // const result = await smsService.send({
      //   to: payload.phoneNumber,
      //   message: payload.smsContent || payload.message,
      // });

      console.log(`[SMS Pending] Would send to user: ${payload.userId}`);
      return { sent: false, error: 'SMS service not yet implemented' };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  /**
   * Send push notification (placeholder for future integration)
   */
  private static async sendPush(
    payload: NotificationPayload,
    pushService: any,
  ): Promise<{ sent: boolean; id?: string; error?: string }> {
    try {
      if (!pushService) {
        return { sent: false, error: 'Push service not configured' };
      }

      // When push service is ready, implement here
      // const result = await pushService.send({
      //   userId: payload.userId,
      //   title: payload.pushTitle || payload.title,
      //   body: payload.pushBody || payload.message,
      //   data: payload.metadata,
      // });

      console.log(`[Push Pending] Would send to user: ${payload.userId}`);
      return { sent: false, error: 'Push service not yet implemented' };
    } catch (error: any) {
      return { sent: false, error: error.message };
    }
  }

  /**
   * Helper: Parse notification preferences from JSON
   * Handles the JSON stored in organization.settings
   */
  static parsePreferences(settings: any): NotificationPreferences {
    if (!settings) {
      return { email: true, inApp: true, sms: false, push: false };
    }

    // If settings is a JSON string, parse it
    let parsed = settings;
    if (typeof settings === 'string') {
      try {
        parsed = JSON.parse(settings);
      } catch {
        return { email: true, inApp: true, sms: false, push: false };
      }
    }

    // Extract notification preferences
    const prefs = parsed?.notificationPreference || parsed?.notificationPreferences || parsed;

    return {
      email: prefs?.email !== false,
      inApp: prefs?.inApp !== false,
      sms: prefs?.sms === true,
      push: prefs?.push === true,
    };
  }

  /**
   * Helper: Build default preferences
   */
  static getDefaultPreferences(): NotificationPreferences {
    return {
      email: true,
      inApp: true,
      sms: false,
      push: false,
    };
  }
}
