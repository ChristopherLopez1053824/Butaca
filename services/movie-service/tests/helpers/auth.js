import { createHmac } from 'node:crypto';

export const USER_ID = '7f1d6a2e-3b4c-4d5e-8f90-123456789abc';
export const OTHER_USER_ID = '0b7c8d9e-1f20-4a3b-9c4d-567890abcdef';

const ISSUER = process.env.SUPABASE_JWT_ISSUER;
const SECRET = process.env.SUPABASE_JWT_SECRET;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signToken({
  sub = USER_ID,
  issuer = ISSUER,
  audience = 'authenticated',
  expiresIn = 300
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub,
    role: 'authenticated',
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + expiresIn
  });
  const unsigned = `${header}.${payload}`;
  const signature = createHmac('sha256', SECRET)
    .update(unsigned)
    .digest('base64url');

  return `${unsigned}.${signature}`;
}
