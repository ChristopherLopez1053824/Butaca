import { createAuthMiddleware } from '@butaca/auth';
import { AppError, ERROR_CODES } from '../errors.js';
import { env } from '../config/env.js';

const authenticate = createAuthMiddleware({
  supabaseUrl: env.SUPABASE_URL,
  issuer: env.SUPABASE_JWT_ISSUER,
  audience: env.SUPABASE_JWT_AUDIENCE,
  jwtSecret: env.SUPABASE_JWT_SECRET,
  jwksUrl: env.SUPABASE_JWKS_URL
});

export function requireAuth(req, res, next) {
  const headers = {};
  const capture = {
    statusCode: 200,
    set(name, value) {
      headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      for (const [name, value] of Object.entries(headers)) {
        res.set(name, value);
      }

      next(new AppError({
        statusCode: this.statusCode,
        code: this.statusCode === 401
          ? ERROR_CODES.UNAUTHORIZED
          : ERROR_CODES.INTERNAL_ERROR,
        message: body?.message ?? 'No autorizado',
        details: body?.details ?? []
      }));
    }
  };

  return authenticate(req, capture, next);
}
