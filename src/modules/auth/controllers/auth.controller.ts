import { Controller, Post, Body, Get, UseGuards, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto } from '../dto/AuthDTO';
import { AuthGuard } from '../guards/auth.guard';
import { ResponseUtil } from '../../../utils/responses';
import { AUTH_SUCCESS_MESSAGES } from '../constant/auth.constant';
import { ResponseMessage } from 'src/shared/decorators/response_message.decorator';
import {ZodResponse} from "nestjs-zod"

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @ResponseMessage(AUTH_SUCCESS_MESSAGES.register)
  async register(@Body() dto: RegisterDto, res: Response) {
    const result = await this.authService.register(dto);
    return ResponseUtil.success(result, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(dto);
    return ResponseUtil.success(result, res);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto, @Res() res: Response) {
    const result = await this.authService.refreshToken(dto.refreshToken);
    return ResponseUtil.success(result, res);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto, @Res() res: Response) {
    await this.authService.changePassword(req.user!.id, dto);
    return ResponseUtil.success({ message: 'Password changed successfully' }, res);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const profile = await this.authService.getProfile(req.user!.id);
    return ResponseUtil.success(profile, res);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Res() res: Response) {
    // In a real implementation, you might want to blacklist the token
    // For now, just return success
    return ResponseUtil.success({ message: 'Logged out successfully' }, res);
  }
}