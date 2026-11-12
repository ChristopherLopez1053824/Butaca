import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify
} from 'jose';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ASYMMETRIC_ALGORITHMS = Object.freeze(['RS256', 'ES256']);
const LEGACY_ALGORITHM = 'HS256';
const DEFAULT_AUDIENCE = 'authenticated';

class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

//Authorization: Bearer eyJhbGciOi...

function bearerToken(authorization) {
  if (typeof authorization !== 'string') {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match ? match[1] : null;
}

function sendUnauthorized(res, message) {
  res.set('WWW-Authenticate', 'Bearer');
  return res.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED',
    message
  });
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function loadConfig(options) {
  const supabaseUrl = options.supabaseUrl ?? process.env.SUPABASE_URL;
  const issuer = options.issuer ?? process.env.SUPABASE_JWT_ISSUER
    ?? (supabaseUrl ? `${trimTrailingSlash(supabaseUrl)}/auth/v1` : undefined);
  const audience = options.audience ?? process.env.SUPABASE_JWT_AUDIENCE
    ?? DEFAULT_AUDIENCE;
  const jwtSecret = options.jwtSecret ?? process.env.SUPABASE_JWT_SECRET;
  const jwksUrl = options.jwksUrl ?? process.env.SUPABASE_JWKS_URL
    ?? (supabaseUrl
      ? `${trimTrailingSlash(supabaseUrl)}/auth/v1/.well-known/jwks.json`
      : undefined);

  if (!issuer) {
    throw new AuthConfigurationError(
      'SUPABASE_URL o SUPABASE_JWT_ISSUER no está configurado'
    );
  }

  if (!audience) {
    throw new AuthConfigurationError(
      'SUPABASE_JWT_AUDIENCE no está configurado'
    );
  }

  if (!jwksUrl && !jwtSecret) {
    throw new AuthConfigurationError(
      'SUPABASE_URL/SUPABASE_JWKS_URL o SUPABASE_JWT_SECRET no está configurado'
    );
  }

  return {
    issuer,
    audience,
    jwtSecret,
    jwksUrl
  };
}

export function createAuthMiddleware(options = {}) {
  let config;
  let jwks;

  function getConfig() {
    if (!config) {
      config = loadConfig(options);
    }

    return config;
  }

  function getJwks() {
    const currentConfig = getConfig();

    if (!currentConfig.jwksUrl) {
      return null;
    }

    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(currentConfig.jwksUrl));
    }

    return jwks;
  }

  return async function requireAuth(req, res, next) {
    const token = bearerToken(req.headers?.authorization);

    if (!token) {
      return sendUnauthorized(res, 'Token de autenticación requerido');
    }

    let header;

    try {
      header = decodeProtectedHeader(token);
    } catch {
      return sendUnauthorized(res, 'Token de autenticación inválido');
    }

    try {
      const currentConfig = getConfig();
      let key;
      let algorithms;

      if (header.alg === LEGACY_ALGORITHM) {
        if (!currentConfig.jwtSecret) {
          return sendUnauthorized(res, 'Token de autenticación inválido');
        }

        key = new TextEncoder().encode(currentConfig.jwtSecret);
        algorithms = [LEGACY_ALGORITHM];
      } else if (ASYMMETRIC_ALGORITHMS.includes(header.alg)) {
        key = getJwks();

        if (!key) {
          return sendUnauthorized(res, 'Token de autenticación inválido');
        }

        algorithms = ASYMMETRIC_ALGORITHMS;
      } else {
        return sendUnauthorized(res, 'Token de autenticación inválido');
      }

      const { payload } = await jwtVerify(token, key, {
        issuer: currentConfig.issuer,
        audience: currentConfig.audience,
        algorithms
      });

      if (typeof payload.sub !== 'string' || !UUID_PATTERN.test(payload.sub)) {
        return sendUnauthorized(res, 'Token de autenticación inválido');
      }

      req.auth = {
        userId: payload.sub,
        role: payload.role,
        claims: payload
      };

      return next();
    } catch (error) {
      if (error instanceof AuthConfigurationError) {
        return res.status(500).json({
          status: 'error',
          code: 'AUTH_CONFIGURATION_ERROR',
          message: 'La autenticación no está configurada correctamente'
        });
      }

      if (error?.code === 'ERR_JWT_EXPIRED') {
        return sendUnauthorized(res, 'Token de autenticación expirado');
      }

      return sendUnauthorized(res, 'Token de autenticación inválido');
    }
  };
}

export const requireAuth = createAuthMiddleware();
