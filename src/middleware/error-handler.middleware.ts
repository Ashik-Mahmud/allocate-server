import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../errors/AppError';

@Catch()
export class ErrorHandler implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof AppError) {
      status = exception.statusCode;
      message = exception.message;
      error = exception.constructor.name;
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.constructor.name;
    }

    const errorResponse = {
      success: false,
      error: {
        code: error,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}