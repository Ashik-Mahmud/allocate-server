import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';

@Catch()
export class ErrorHandler implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal Server Error';
    let code = exception?.constructor?.name || 'Error';

    // 1. Handle Zod Specific Errors
    // 1. Handle Zod Specific Errors
    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;

      // Try to get the detailed list of field errors
      try {
        const zodError: any = exception.getZodError();
        const errors = zodError.issues || (zodError as any).errors || [];
        message = errors.map(err => ({
          field: err.path.join('.'),
          issue: err.message
        }));
      } catch (e) {
        // Fallback if getZodError() fails: show the raw string
        message = exception.message || "Validation failed";
      }
    }
     // 3. Handle Throttler (Rate Limit)
    else if (exception.constructor.name === 'ThrottlerException') {

      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'Too many registration attempts. Please try again in a minute.';
    }
    // 2. Handle standard NestJS HttpExceptions
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? (res as any).message : res;
    }
   
    // 4. NEW: Handle Generic Errors (TypeErrors, Prisma crashes, etc.)
    else if (exception instanceof Error) {
      message = exception.message; // This will now say "bcrypt is not found"
    }
    // CRITICAL: Log the full error to your terminal so you can see the line numbers
    if (status === 500) {
      console.error('--- SERVER ERROR ---');
      console.error(exception);
      console.error('--------------------');
    }

    response.status(status).json({
      success: false,
      error: {
        code: code,
        message: message,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}