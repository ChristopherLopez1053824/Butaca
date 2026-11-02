import { beforeAll, describe, expect, it } from 'vitest';

let withUserContext;
let createUserContext;

beforeAll(async () => {
  process.env.DATABASE_URL =
    'postgresql://butaca:butaca@127.0.0.1:1/butaca_sin_conexion';

  ({ withUserContext, createUserContext } = await import('../src/user-context.js'));
});

describe('withUserContext validation', () => {
  it('rechaza un userId que no es UUID antes de abrir la transacción', async () => {
    await expect(
      withUserContext('usuario-invalido', async () => {})
    ).rejects.toThrow(TypeError);
  });

  it('rechaza un callback que no es función', async () => {
    await expect(
      withUserContext('7f1d6a2e-3b4c-4d5e-8f90-123456789abc', null)
    ).rejects.toThrow(TypeError);
  });

  it('rechaza un cliente Prisma inválido', () => {
    expect(() => createUserContext(null)).toThrow(TypeError);
  });
});
