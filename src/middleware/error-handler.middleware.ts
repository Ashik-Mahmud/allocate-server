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
    let code = exception.constructor.name;

    // 1. Handle Zod Specific Errors
    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      // This extracts the actual field errors (e.g., "email is invalid")
      message = (exception as any)?.getZodError().errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
    } 
    // 2. Handle standard NestJS HttpExceptions (like Unauthorized, NotFound)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? (res as any).message : res;
    }

    // Return the structure you want
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