import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError, mongo as MongoNativeError } from 'mongoose';

@Catch()
export class HttpExceptioFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof MongooseError.ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';

      const errors = Object.entries(exception.errors).map(([field, error]) => {
        const validatorError = error as Error;
        return {
          field,
          message: validatorError.message,
        };
      });

      return response.status(status).json({
        statusCode: status,
        message,
        errors,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    if (exception instanceof MongooseError.CastError) {
      status = HttpStatus.BAD_REQUEST;
      message = `Invalid value for ${exception.path}: "${exception.value}"`;

      return response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    if (
      exception instanceof MongoNativeError.MongoServerError &&
      exception.code === 11000
    ) {
      status = HttpStatus.CONFLICT;
      message = `Duplicate key error: ${Object.keys(exception.keyPattern).join(', ')}`;

      return response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      let message: string | object = 'Internal server error';
      message = exception.getResponse();

      return response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    return response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
