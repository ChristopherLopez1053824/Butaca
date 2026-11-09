import { AppError, ERROR_CODES } from '../errors.js';

export function notFoundHandler(req, res, next) {
  next(new AppError({
    statusCode: 404,
    code: ERROR_CODES.NOT_FOUND,
    message: `La ruta ${req.method} ${req.originalUrl} no existe`
  }));
}
