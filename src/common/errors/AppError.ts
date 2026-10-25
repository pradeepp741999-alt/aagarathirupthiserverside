import { ErrorCode } from './errorCodes';

export interface FieldErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: FieldErrorDetail[] | Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: FieldErrorDetail[] | Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
