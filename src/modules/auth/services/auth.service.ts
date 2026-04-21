import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JWTUtils, TokenPair } from '../utils/jwt';
import { CryptoUtils } from '../utils/crypto';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/AuthDTO';
import { PaymentStatus, PlanType, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import GLOBAL_CONFIG from 'src/shared/constant/global.constant';
import { EmailService } from 'src/modules/inbox/service/email.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private emailService: EmailService) { }

  async register(dto: RegisterDto): Promise<TokenPair & { user: Partial<User> }> {

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await CryptoUtils.hashPassword(dto.password);

    // Create user and orgnaization in a transaction
    const user = await this.prisma.$transaction(async (prisma) => {
      // orgnization
      const organization = await prisma.organizations.create({
        data: {
          name: dto.name,
          plan_type: PlanType.FREE, // Default plan type for new organizations
        },
      });

      // user
      const createdUser = await prisma.user.create({
        data: {
          ...dto,
          password: hashedPassword,
          org_id: organization.id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          org_id: true,
        },
      });

      // subscription creation for new organization
      await prisma.subscription.create({
        data: {
          org_id: organization.id,
          plan_name: PlanType.FREE,
          start_date: new Date(),
          end_date: new Date(Date.now() + GLOBAL_CONFIG.FREE_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000), // Free plan duration
          payment_status: PaymentStatus.COMPLETED
        },
      });


      return createdUser;
    });

    // Generate tokens
    if (!user.org_id) {
      throw new UnauthorizedException('User organization not found');
    }

    const tokens = JWTUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: user.org_id,
    });
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    return { ...tokens, user };
  }

  // login
  async login(dto: LoginDto): Promise<TokenPair & { user: Partial<User> & { needUpdateOrg: boolean } }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, },
      include: { organization: true }
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials or user not found');
    }

    // Verify password
    const isPasswordValid = await CryptoUtils.comparePassword(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials or user not found');
    }

    // Check if organization exists 
    if (!user?.org_id && !user?.organization) {
      throw new UnauthorizedException('User organization not found');
    }

    // Check if organization is active
    if (!user?.organization?.is_active) {
      throw new UnauthorizedException('Your organization has been suspended. Please contact support.');
    }


    // Update last login time
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });


    const tokens = JWTUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: user?.organization?.id || user?.org_id || '', // Fallback to default org ID if not set
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        org_id: user.org_id,
        needUpdateOrg: user?.organization?.needUpdateOrg || false,
      },
    };
  }

  // refresh token
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = JWTUtils.verifyToken(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, deletedAt: true, org_id: true },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new tokens
      return JWTUtils.generateTokens({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        orgId: payload.orgId || user.org_id || '', // Fallback to org ID from token or user record
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
  //forgotPassword
  async forgotPassword(email: string): Promise<void> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate reset token
    const resetToken = JWTUtils.generateResetToken({
      userId: user.id,
      email: user.email,
    });

    // TODO: Send email with reset token


    // Send email with reset token
  }
  //change password
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await CryptoUtils.comparePassword(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await CryptoUtils.hashPassword(dto.newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}