import { Module, NestModule } from '@nestjs/common';
import { SharedService } from 'src/shared/services/shared.service';
import { EmailService } from '../inbox/service/email.service';
import { AuthController } from './controllers/auth.controller';
import { AuthGuard } from './guards/auth.guard';
import {
    AuthMiddleware,
    OptionalAuthMiddleware,
} from './middleware/auth.middleware';
import { AuthService } from './services/auth.service';

@Module({
  //imports: [AuthMiddleware, OptionalAuthMiddleware],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthMiddleware,
    OptionalAuthMiddleware,
    AuthGuard,
    EmailService,
    SharedService,
  ],
  exports: [AuthService, AuthMiddleware, OptionalAuthMiddleware, AuthGuard],
})
export class AuthModule implements NestModule {
  configure() { //consumer: MiddlewareConsumer
    // Apply optional auth to routes that might need user context but don't require auth
    // consumer.apply(OptionalAuthMiddleware).forRoutes('*');
  }
}
