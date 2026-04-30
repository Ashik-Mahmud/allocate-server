import { Injectable, ConflictException, UnauthorizedException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { JWTUtils, TokenPair } from '../utils/jwt';
import { CryptoUtils } from '../utils/crypto';
import { RegisterDto, LoginDto, ChangePasswordDto, UpdateProfileDto } from '../dto/AuthDTO';
import { PaymentStatus, PlanType, Prisma, Role, TransactionType, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import GLOBAL_CONFIG from 'src/shared/constant/global.constant';
import { EmailService } from 'src/modules/inbox/service/email.service';
import { v4 as uuidv4 } from 'uuid';
import { SharedService } from 'src/shared/services/shared.service';
import { Response } from 'express';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private sharedService: SharedService
  ) { }

  async register(dto: RegisterDto): Promise<TokenPair & { user: Partial<User> & { needUpdateOrg: boolean } }> {

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
          credit_pool: GLOBAL_CONFIG.FREE_PLAN_CREDITS || 100, // Default credits for free plan
          settings: {
            notification_preferences: {
              email: true,
              sms: false,
              push: false,
              inApp: true,
            },
          }
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
          is_verified: true,
          organization: {
            select: {
              needUpdateOrg: true,
            },
          },
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

      // Credit transaction for free plan allocation
      await prisma.creditTransaction.create({
        data: {
          org_id: organization.id,
          amount: GLOBAL_CONFIG.FREE_PLAN_CREDITS || 100,
          type: TransactionType.FREE_ALLOCATION,
          performedBy: createdUser.id,
          previousBalance: 0,
          currentBalance: GLOBAL_CONFIG.FREE_PLAN_CREDITS || 100,
          description: 'Free plan allocation',
          user_id: createdUser.id,
        },
      });

      // Log activity for organization creation and user registration
      await this.sharedService.logActivity(prisma, {
        userId: createdUser.id,
        orgId: organization.id,
        action: 'USER_REGISTERED',
        details: `User ${createdUser.email} registered and organization ${organization.name} created`,
        metadata: { plan_type: organization.plan_type, createdBy: createdUser.id, creatorName: createdUser.name, defaultCredit: GLOBAL_CONFIG.FREE_PLAN_CREDITS || 100 },
      });
      await this.sharedService.logActivity(prisma, {
        userId: createdUser.id,
        orgId: organization.id,
        action: 'ORGANIZATION_CREATED',
        details: `Organization ${organization.name} created with ID ${organization.id}`,
        metadata: { plan_type: organization.plan_type, createdBy: createdUser.id, creatorName: createdUser.name, defaultCredit: GLOBAL_CONFIG.FREE_PLAN_CREDITS || 100 },
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
      await this.emailService.sendWelcomeEmail(user.email, user.name); // Send welcome email after registration
      await this.sendVerificationEmail(user.email, user.name); // Send verification email after registration
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    return {
      ...tokens, user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        org_id: user.org_id,
        needUpdateOrg: user?.organization?.needUpdateOrg || false,
        is_verified: user.is_verified,
      }
    };
  }

  // login
  async login(dto: LoginDto, res: Response): Promise<TokenPair & { user: Partial<User> & { needUpdateOrg: boolean } }> {
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
    if (!user?.org_id && !user?.organization && user?.role !== Role.ADMIN) {
      throw new UnauthorizedException('User organization not found');
    }

    // Check if organization is active
    if (!user?.organization?.is_active && user?.role !== Role.ADMIN && user?.role !== Role.ORG_ADMIN) {
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

    // log activity
    const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
    const userAgent: string = res.req.headers['user-agent'] || 'unknown';
    await this.sharedService.logActivity(this.prisma, {
      userId: user.id,
      orgId: user.org_id || '',
      action: 'USER_LOGIN',
      details: `User ${user.email} logged in`,
      ipAddress: ipAddress,
      userAgent: userAgent,
      metadata: { org_id: user?.organization?.id || user?.org_id || '', role: user.role },
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
        is_verified: user.is_verified,
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

  async getProfile(userId: string, role: Role): Promise<Partial<User>> {

    const selectOrgFieldsForStaff: Prisma.OrganizationsSelect = {
      business_email: true,
      id: true,
      name: true,
      settings: true,
      address: true,
      org_type: true,
      slug: true,
      tagline: true,
      isVerified: true,
      is_active: true,
      photo: true,
      timezone: true,
      needUpdateOrg: true
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        photo: true,
        org_id: true,
        last_login: true,
        personal_credits: true,
        organization: role === Role.STAFF ? { select: selectOrgFieldsForStaff } : true,
        is_verified: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // update profile
  async updateProfile(dto: UpdateProfileDto, res: Response, user: User): Promise<Partial<User>> {

    if (!user.id) {
      throw new NotFoundException('User not found');
    }
    const existUser = await this.prisma.user.findUnique({
      where: { id: user?.id },
    });
    if (!existUser) {
      throw new NotFoundException('User not found');
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: user?.id },
      data: {
        name: dto.name,
        photo: dto.photo,
      },
    })
    // log activity
    const ipAddress = (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '';
    const userAgent: string = res.req.headers['user-agent'] || 'unknown';

    await this.sharedService.logActivity(this.prisma, {
      userId: user?.id,
      orgId: user?.org_id || updatedUser?.org_id || '',
      action: 'PROFILE_UPDATE',
      details: `User ${user.email} updated profile`,
      ipAddress: ipAddress,
      userAgent: userAgent,
      metadata: { org_id: user?.org_id, updatedFields: Object.keys(dto) },
    })
    return updatedUser;
  }

  // send verification email
  async sendVerificationEmail(email: string, name: string): Promise<void> {
    // Generate verification token
    try {
      const verificationToken = uuidv4();
      const expiryDate = new Date(Date.now() + GLOBAL_CONFIG.VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      // Update user with verification token
      const user = await this.prisma.user.update({
        where: { email },
        data: {
          verification_token: verificationToken,
          token_expiry: expiryDate, // Set the expiry date for the token
        },
      })
      const verificationLink = `${process.env.WEB_APP_LINK}/verify-email?token=${verificationToken}`;
      await this.emailService.sendVerifyEmail(email, user.name, verificationLink, GLOBAL_CONFIG.VERIFICATION_TOKEN_EXPIRY_MINUTES);
    } catch (error: any) {
      console.log(error, 'error')
      throw new InternalServerErrorException('Failed to send verification email');
    }

  }

  // verify email
  async verifyEmail(token: string, user: User): Promise<void> {

    console.log(token)
    const dbUser = await this.prisma.user.findUnique({
      where: { verification_token: token },
      select: { id: true, deletedAt: true, is_verified: true, token_expiry: true },
    });

    if (!dbUser || dbUser.deletedAt) {
      throw new NotFoundException('User not found or inactive');
    }
    if (dbUser.is_verified) {
      throw new ConflictException('Email is already verified');
    }
    // check token has expired or not and get user with the token
    if (dbUser.token_expiry && dbUser.token_expiry < new Date()) {
      throw new UnauthorizedException('Verification token has expired');
    }

    await this.prisma.user.update({
      where: { id: dbUser.id },
      data: { is_verified: true, verification_token: null, token_expiry: null },
    });

  }

  // logout
  async logout(user: User, res: Response): Promise<void> {
    // Invalidate tokens if you are using a token blacklist (not implemented here)
    // For now, just return success
    await this.sharedService.logActivity(this.prisma, {
      userId: user.id,
      orgId: user.org_id || '',
      action: 'USER_LOGOUT',
      details: `User ${user.email} logged out`,
      ipAddress: (res?.req?.headers['x-forwarded-for'] as string) || res?.req?.ip || res?.req?.connection?.remoteAddress || '',
      userAgent: res.req.headers['user-agent'] || 'unknown',
      metadata: { org_id: user?.org_id || '', role: user.role },
    });
  }



}