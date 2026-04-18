import * as jwt from 'jsonwebtoken';
import { env } from '../../../shared/config/env';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  orgId: string;
  type: 'access' | 'refresh';
}

export interface JWTPayloadReset {
  userId: string;
  email: string;
  type: 'reset';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTUtils {
  static generateTokens(payload: Omit<JWTPayload, 'type'>): TokenPair {
    const accessPayload: JWTPayload = { ...payload, type: 'access' };
    const refreshPayload: JWTPayload = { ...payload, type: 'refresh' };

    const accessOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN };
    const refreshOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN };
    const accessToken = jwt.sign(accessPayload, env.JWT_SECRET as string, accessOptions as any);

    const refreshToken = jwt.sign(refreshPayload, env.JWT_SECRET as string, refreshOptions as any);

    return { accessToken, refreshToken };
  }

  // generate reset token
  static generateResetToken(payload: Omit<JWTPayloadReset, 'type'>): string {
    const resetPayload: JWTPayloadReset = { ...payload, type: 'reset' };
    const resetOptions = { expiresIn: env.RESET_PASSWORD_TOKEN_ENPIRES_IN };
    const resetToken = jwt.sign(resetPayload, env.JWT_SECRET as string, resetOptions as any);
    return resetToken;
  }

  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }


  static extractToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}