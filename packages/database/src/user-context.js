import { prisma } from './client.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUTHENTICATED_ROLE = 'authenticated';

function assertUserId(userId) {
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    throw new TypeError('userId debe ser un UUID válido');
  }
}

function assertCallback(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback debe ser una función');
  }
}

export function createUserContext(prismaClient) {
  if (!prismaClient || typeof prismaClient.$transaction !== 'function') {
    throw new TypeError('prismaClient debe ser un cliente Prisma válido');
  }

  return async function withUserContext(userId, callback) {
    assertUserId(userId);
    assertCallback(callback);

    const claims = JSON.stringify({
      sub: userId,
      role: AUTHENTICATED_ROLE
    });

    return prismaClient.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT set_config('request.jwt.claims', ${claims}, true)
      `;
      await tx.$queryRaw`
        SELECT set_config('request.jwt.claim.sub', ${userId}, true)
      `;
      await tx.$queryRaw`
        SELECT set_config('request.jwt.claim.role', ${AUTHENTICATED_ROLE}, true)
      `;
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;

      return callback(tx);
    });
  };
}

export const withUserContext = createUserContext(prisma);
