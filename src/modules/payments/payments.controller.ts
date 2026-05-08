import { Body, Controller, Headers, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { RolesGuard } from 'src/shared/guards';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './payments.dto';
import { Response } from 'express';
import { CurrentUser, CurrentUserType } from 'src/shared/decorators/user.decorator';
import { ResponseUtil } from 'src/utils/responses';

@ApiTags('Payments')
@ApiBearerAuth()
// Restrict access to admin and org admin roles
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @UseGuards(AuthGuard, RolesGuard) // Add appropriate guards when implementing endpoints
    @Roles(Role.ADMIN, Role.ORG_ADMIN)
    @Post('stripe/create-checkout')
    async createCheckout(@Body() dto: CreateCheckoutDto, @Res() res: Response, @CurrentUser() user: CurrentUserType) {
        const result = await this.paymentsService.createCheckoutSession(dto, user);
        return ResponseUtil.success(result, res);
    }



    @Post('webhook')
    async handleStripeWebhook(
        @Headers('stripe-signature') signature: string, 
        @Req() req: Request,
        @Res() res: Response
    ) {
        if (!signature) {
            return res.status(400).send('No signature found');
        }
        // Implement webhook handling logic here
         const result = await this.paymentsService.handleStripeWebhook(signature, req);
        // Verify the event and update subscription status in your database accordingly
        return ResponseUtil.success({ received: true }, res);
    }

}
