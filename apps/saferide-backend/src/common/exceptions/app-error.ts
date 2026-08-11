import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code?: string,
  ) {
    super({ code: code ?? 'APP_ERROR', message }, status);
  }
}

export const Errors = {
  notFound: (msg = 'Resource not found') =>
    new AppError(msg, HttpStatus.NOT_FOUND, 'NOT_FOUND'),
  conflict: (msg: string, code = 'CONFLICT') =>
    new AppError(msg, HttpStatus.CONFLICT, code),
  forbidden: (msg = 'Forbidden') =>
    new AppError(msg, HttpStatus.FORBIDDEN, 'FORBIDDEN'),
  unauthorized: (msg = 'Unauthorized') =>
    new AppError(msg, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'),
  badRequest: (msg: string, code = 'BAD_REQUEST') =>
    new AppError(msg, HttpStatus.BAD_REQUEST, code),
};
