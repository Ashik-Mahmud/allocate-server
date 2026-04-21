import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthMiddleware, OptionalAuthMiddleware } from './middleware/auth.middleware';
import { AuthGuard } from './guards/auth.guard';
import { EmailService } from '../inbox/service/email.service';

@Module({
  //imports: [AuthMiddleware, OptionalAuthMiddleware],
  controllers: [AuthController],
  providers: [AuthService,AuthMiddleware, OptionalAuthMiddleware, AuthGuard, EmailService],
  exports: [AuthService, AuthMiddleware, OptionalAuthMiddleware, AuthGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply optional auth to routes that might need user context but don't require auth
    // consumer.apply(OptionalAuthMiddleware).forRoutes('*');
  }
}