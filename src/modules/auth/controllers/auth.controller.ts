import { Controller, Post, Body, Get, UseGuards, Req, Res, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto, ForgotPasswordDto } from '../dto/AuthDTO';
import { AuthGuard } from '../guards/auth.guard';
import { ResponseUtil } from '../../../utils/responses';
import { AUTH_SUCCESS_MESSAGES } from '../constant/auth.constant';
import { ResponseMessage } from 'src/shared/decorators/response_message.decorator';
import { ZodResponse } from "nestjs-zod"
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from 'src/shared/decorators/user.decorator';
import { User } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // Write a minimum understandable comment for each method in this controller

  /**
  * Registers a new user with the provided registration details.
  * @param dto - The registration details of the user.
  * @param res - The response object to send the result back to the client.
  * @return A success response containing the token pair and user information if registration is successful.
  */
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: 3, ttl: 60000 }
  })
  @Post('register')
  @ResponseMessage(AUTH_SUCCESS_MESSAGES.register)
  async register(@Body() dto: RegisterDto, res: Response) {
    const result = await this.authService.register(dto);
    return ResponseUtil.success(result, res);
  }

  /**
   * Logs in a user with the provided login details.
   * @param dto - The login details of the user.
   * @param res - The response object to send the result back to the client.
   * @return A success response containing the token pair if login is successful.
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: 3, ttl: 60000 }
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(dto);
    return ResponseUtil.success(result, res);
  }

  // Refresh token
  /**
   * Refreshes the access token using the provided refresh token.
   * @param dto - The refresh token details.
   * @param res - The response object to send the result back to the client.
   * @return A success response containing the new token pair if refresh is successful.
   */
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto, @Res() res: Response) {
    const result = await this.authService.refreshToken(dto.refreshToken);
    return ResponseUtil.success(result, res);
  }

  // Forgot password
  /**
   * Initiates the password reset process for a user.
   * @param dto - The email address of the user.
   * @param res - The response object to send the result back to the client.
   * @return A success response indicating that the password reset link has been sent.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Password reset link sent successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Res() res: Response) {
    await this.authService.forgotPassword(dto.email);
    return ResponseUtil.success({ message: 'Password reset link sent successfully' }, res);
  }

  /**
   * Changes the password for the authenticated user.
   * @param req - The HTTP request object containing the authenticated user's information.
   * @param dto - The new password details.
   * @param res - The response object to send the result back to the client.
   * @return A success response indicating that the password has been changed.
   */
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

  /**
   * Retrieves the profile information of the authenticated user.
   * @param req - The HTTP request object containing the authenticated user's information.
   * @param res - The response object to send the result back to the client.
   * @return A success response containing the user's profile information.
   */
  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const profile = await this.authService.getProfile(req.user!.id);
    return ResponseUtil.success(profile, res);
  }

  /**
   *  Sends a verification email to the authenticated user.
   * @param user - The current authenticated user.
   * @param res - The response object to send the result back to the client.
   * @return A success response indicating that the verification email has been sent.
   */

  @Post('send-verification-email')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent successfully' })
  async sendVerificationEmail(@CurrentUser() user: User, @Res() res: Response) {
    try {
      await this.authService.sendVerificationEmail(user.email, user.name);
      return ResponseUtil.success({ message: `Verification email sent to ${user.email}` }, res);
    } catch (error: any) { 
      return ResponseUtil.error(error.message, 500, res);
    }
  }


  /**
   * Verify email address for a user.
   * @param token - The verification token sent to the user's email.
   * @param res - The response object to send the result back to the client.
   */
  @Get('verify')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Query('token') token: string, @CurrentUser() user: User, @Res() res: Response) {
    try {
      await this.authService.verifyEmail(token, user);
      return ResponseUtil.success({ message: 'Email verified successfully' }, res);
    } catch (error: any) {
      return ResponseUtil.error(error.message, 400, res);
    }
  }

  /**
   * Logs out the authenticated user.
   * @param res - The response object to send the result back to the client.
   * @return A success response indicating that the user has been logged out.
   */
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