import {
    Body,
    Controller,
    Headers,
    HttpCode,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentProvider, Role } from '@prisma/client';
import { Request, Response } from 'express';
import { Roles } from 'src/shared/decorators/roles.decorator';
import {
    CurrentUser,
    CurrentUserType,
} from 'src/shared/decorators/user.decorator';
import { RolesGuard } from 'src/shared/guards';
import { ResponseUtil } from 'src/utils/responses';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateCheckoutDto } from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
// Restrict access to admin and org admin roles
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(AuthGuard, RolesGuard) // Add appropriate guards when implementing endpoints
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  @Post('create-checkout')
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @Res() res: Response,
    @CurrentUser() user: CurrentUserType,
  ) {
    let result;
    if (
      dto?.payment_gateway === PaymentProvider.STRIPE ||
      !dto?.payment_gateway
    ) {
      result = await this.paymentsService.createCheckoutSession(dto, user);
    } else {
      result = await this.paymentsService.createSSLCOMMERZSession(dto, user);
    }
    return ResponseUtil.success(result, res);
  }

  @Post('webhook')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!signature) {
      return res.status(400).send('No signature found');
    }
    // Implement webhook handling logic here
    await this.paymentsService.handleStripeWebhook(
      signature,
      req,
    );
    // Verify the event and update subscription status in your database accordingly
    return ResponseUtil.success({ received: true }, res);
  }

  @Post('ssl-webhook')
  @HttpCode(200)
  async handleSSLIPN(
    @Body() body: any,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    console.log('IPN Received');
    // Implement IPN handling logic here
    await this.paymentsService.handleSSLIPN(body, req);
    return res.status(200).send('Ok');
  }

  @Post('activate-trial')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORG_ADMIN)
  async activateTrial(
    @CurrentUser() user: CurrentUserType,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.activateTrial(user);
    return ResponseUtil.success(result, res);
  }
}
