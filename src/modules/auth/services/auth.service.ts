import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JWTUtils, TokenPair } from '../utils/jwt';
import { CryptoUtils } from '../utils/crypto';
import { RegisterDto, LoginDto, ChangePasswordDto } from '../dto/AuthDTO';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<TokenPair & { user: Partial<User> }> {
   
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
  
    // Hash password
    const hashedPassword = await CryptoUtils.hashPassword(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data:{
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    })

  
    // Generate tokens
    const tokens = JWTUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    console.log(tokens, 'tokens')
    return { ...tokens, user };
  }

  async login(dto: LoginDto): Promise<TokenPair & { user: Partial<User> }> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await CryptoUtils.comparePassword(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = JWTUtils.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = JWTUtils.verifyToken(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new tokens
      return JWTUtils.generateTokens({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

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