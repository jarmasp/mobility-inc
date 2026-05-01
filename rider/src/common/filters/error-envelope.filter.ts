import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
}

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else {
        const parsedBody = body as HttpExceptionBody;
        if (Array.isArray(parsedBody.message)) {
          message = parsedBody.message.join(', ');
        } else if (parsedBody.message) {
          message = parsedBody.message;
        } else if (parsedBody.error) {
          message = parsedBody.error;
        }
      }
    }

    response.status(status).json({ error: message });
  }
}
