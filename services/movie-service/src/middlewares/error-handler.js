import { ZodError } from 'zod';
import { AppError, ERROR_CODES, errorResponse } from '../errors.js';

function normalizeError(error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'La solicitud no es válida',
      details: error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    };
  }

  if (error?.type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'El cuerpo de la solicitud no es un JSON válido'
    };
  }

  return {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Error interno del servidor'
  };
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const { statusCode, code, message, details = [] } = normalizeError(error);

  return res.status(statusCode).json(errorResponse(code, message, details));
}
