export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  SERVICE_NOT_CONFIGURED: 'SERVICE_NOT_CONFIGURED',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT'
});

export class AppError extends Error {
  constructor({ statusCode, code, message, details = [] }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(code, message, details = []) {
  return {
    status: 'error',
    code,
    message,
    details
  };
}
