import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

const TEST_DATABASE_URL = process.env.RLS_TEST_DATABASE_URL;
const TEST_ADMIN_URL = process.env.RLS_TEST_ADMIN_URL;
const USER_A = process.env.RLS_TEST_USER_A;
const USER_B = process.env.RLS_TEST_USER_B;

const configured = Boolean(
  TEST_DATABASE_URL && TEST_ADMIN_URL && USER_A && USER_B
);

let prisma;
let withUserContext;
let createUserContext;
let admin;
let singlePrisma;
let singlePool;
let withUserContextSingle;

async function cleanup() {
  const users = [USER_A, USER_B];

  await admin.query(
    'DELETE FROM public.meme_history WHERE user_id = ANY($1::uuid[])',
    [users]
  );
  await admin.query(
    'DELETE FROM public.recommendations WHERE user_id = ANY($1::uuid[])',
    [users]
  );
  await admin.query(
    'DELETE FROM public.favorites WHERE user_id = ANY($1::uuid[])',
    [users]
  );
  await admin.query(
    'DELETE FROM public.emotion_records WHERE user_id = ANY($1::uuid[])',
    [users]
  );
}

async function createFavorite(userId, overrides = {}) {
  return withUserContext(userId, (tx) =>
    tx.favorite.create({
      data: {
        id: randomUUID(),
        userId,
        tmdbId: 100,
        mediaType: 'MOVIE',
        title: 'Pelicula de prueba',
        ...overrides
      }
    })
  );
}

describe.skipIf(!configured)('RLS integration', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    ({ prisma } = await import('../src/client.js'));
    ({
      withUserContext,
      createUserContext
    } = await import('../src/user-context.js'));

    admin = new Pool({
      connectionString: TEST_ADMIN_URL,
      max: 2
    });

    const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
      import('@prisma/adapter-pg'),
      import('../generated/prisma/client.ts')
    ]);

    singlePool = new Pool({
      connectionString: TEST_DATABASE_URL,
      max: 1
    });
    singlePrisma = new PrismaClient({
      adapter: new PrismaPg(singlePool)
    });
    withUserContextSingle = createUserContext(singlePrisma);

    const users = await admin.query(
      'SELECT id FROM auth.users WHERE id = ANY($1::uuid[])',
      [[USER_A, USER_B]]
    );

    if (users.rowCount !== 2) {
      throw new Error(
        'RLS_TEST_USER_A y RLS_TEST_USER_B deben ser usuarios reales de auth.users'
      );
    }

    await admin.query(
      `
        INSERT INTO public.profiles (id, display_name, updated_at)
        VALUES ($1, 'RLS Test A', now()), ($2, 'RLS Test B', now())
        ON CONFLICT (id) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            updated_at = now()
      `,
      [USER_A, USER_B]
    );

    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    if (admin) {
      await cleanup().catch(() => {});
      await admin.end();
    }

    if (singlePrisma) {
      await singlePrisma.$disconnect();
    }

    if (singlePool) {
      await singlePool.end();
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('establece auth.uid(), claim role y el rol authenticated dentro de la transacción', async () => {
    const row = await withUserContext(USER_A, async (tx) => {
      const [result] = await tx.$queryRaw`
        SELECT
          current_user AS role,
          auth.uid() AS uid,
          current_setting('request.jwt.claim.role', true) AS claim_role
      `;

      return result;
    });

    expect(row.role).toBe('authenticated');
    expect(row.uid).toBe(USER_A);
    expect(row.claim_role).toBe('authenticated');
  });

  it('permite consultar los registros propios', async () => {
    const favorite = await createFavorite(USER_A);

    const found = await withUserContext(USER_A, (tx) =>
      tx.favorite.findUnique({ where: { id: favorite.id } })
    );

    expect(found).not.toBeNull();
    expect(found.userId).toBe(USER_A);
  });

  it('no permite consultar registros de otro usuario', async () => {
    const favorite = await createFavorite(USER_A);

    const found = await withUserContext(USER_B, (tx) =>
      tx.favorite.findUnique({ where: { id: favorite.id } })
    );

    expect(found).toBeNull();
  });

  it('no permite insertar registros asignados a otro usuario', async () => {
    await expect(
      createFavorite(USER_A, {
        id: randomUUID(),
        userId: USER_B,
        title: 'Intento de escritura cruzada'
      })
    ).rejects.toThrow();
  });

  it('no permite actualizar registros de otro usuario', async () => {
    const favorite = await createFavorite(USER_A);

    await expect(
      withUserContext(USER_B, (tx) =>
        tx.favorite.update({
          where: { id: favorite.id },
          data: { title: 'Actualizacion no autorizada' }
        })
      )
    ).rejects.toThrow();

    const found = await withUserContext(USER_A, (tx) =>
      tx.favorite.findUnique({ where: { id: favorite.id } })
    );

    expect(found.title).toBe('Pelicula de prueba');
  });

  it('no permite eliminar registros de otro usuario', async () => {
    const favorite = await createFavorite(USER_A);

    await expect(
      withUserContext(USER_B, (tx) =>
        tx.favorite.delete({ where: { id: favorite.id } })
      )
    ).rejects.toThrow();

    const found = await withUserContext(USER_A, (tx) =>
      tx.favorite.findUnique({ where: { id: favorite.id } })
    );

    expect(found).not.toBeNull();
  });

  it('no permite cambiar user_id de un registro propio', async () => {
    const favorite = await createFavorite(USER_A);

    await expect(
      withUserContext(USER_A, (tx) =>
        tx.favorite.update({
          where: { id: favorite.id },
          data: { userId: USER_B }
        })
      )
    ).rejects.toThrow();

    const found = await withUserContext(USER_A, (tx) =>
      tx.favorite.findUnique({ where: { id: favorite.id } })
    );

    expect(found.userId).toBe(USER_A);
  });

  it('aísla los perfiles entre usuarios', async () => {
    const own = await withUserContext(USER_A, (tx) =>
      tx.profile.findUnique({ where: { id: USER_A } })
    );
    const other = await withUserContext(USER_A, (tx) =>
      tx.profile.findUnique({ where: { id: USER_B } })
    );

    expect(own).not.toBeNull();
    expect(other).toBeNull();
  });

  it('no permite asociar una emoción de otro usuario a una recomendación', async () => {
    const emotion = await withUserContext(USER_B, (tx) =>
      tx.emotionRecord.create({
        data: {
          id: randomUUID(),
          userId: USER_B,
          emotion: 'HAPPY',
          source: 'MANUAL'
        }
      })
    );

    await expect(
      withUserContext(USER_A, (tx) =>
        tx.recommendation.create({
          data: {
            id: randomUUID(),
            userId: USER_A,
            emotionRecordId: emotion.id,
            tmdbId: 200,
            mediaType: 'MOVIE',
            title: 'Recomendacion cruzada'
          }
        })
      )
    ).rejects.toThrow();
  });

  it('no permite asociar una emoción de otro usuario a meme_history', async () => {
    const emotion = await withUserContext(USER_B, (tx) =>
      tx.emotionRecord.create({
        data: {
          id: randomUUID(),
          userId: USER_B,
          emotion: 'SAD',
          source: 'MANUAL'
        }
      })
    );

    await expect(
      withUserContext(USER_A, (tx) =>
        tx.memeHistory.create({
          data: {
            id: randomUUID(),
            userId: USER_A,
            emotionRecordId: emotion.id,
            provider: 'test',
            imageUrl: 'https://example.test/meme.png'
          }
        })
      )
    ).rejects.toThrow();
  });

  it('no filtra el contexto entre dos transacciones consecutivas', async () => {
    const favorite = await createFavorite(USER_A);

    const seenByA = await withUserContext(USER_A, (tx) =>
      tx.favorite.findMany({ where: { id: favorite.id } })
    );
    const seenByB = await withUserContext(USER_B, (tx) =>
      tx.favorite.findMany({ where: { id: favorite.id } })
    );

    expect(seenByA).toHaveLength(1);
    expect(seenByB).toHaveLength(0);
  });

  it('no deja claims en la conexión reutilizada después del commit', async () => {
    await withUserContextSingle(USER_A, async (tx) => {
      const [row] = await tx.$queryRaw`SELECT auth.uid() AS uid`;
      expect(row.uid).toBe(USER_A);
    });

    const settings = await singlePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;

      const [row] = await tx.$queryRaw`
        SELECT
          current_setting('request.jwt.claims', true) AS claims,
          current_setting('request.jwt.claim.sub', true) AS sub,
          current_setting('request.jwt.claim.role', true) AS role
      `;

      return row;
    });

    expect(settings.claims || '').toBe('');
    expect(settings.sub || '').toBe('');
    expect(settings.role || '').toBe('');

    const rows = await singlePrisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;

      return tx.profile.findMany({
        where: { id: USER_A }
      });
    });

    expect(rows).toHaveLength(0);
  });

  it('hace rollback cuando el callback lanza un error', async () => {
    const id = randomUUID();

    await expect(
      withUserContext(USER_A, async (tx) => {
        await tx.favorite.create({
          data: {
            id,
            userId: USER_A,
            tmdbId: 300,
            mediaType: 'MOVIE',
            title: 'Debe revertirse'
          }
        });

        throw new Error('rollback forzado');
      })
    ).rejects.toThrow('rollback forzado');

    const found = await withUserContext(USER_A, (tx) =>
      tx.favorite.findUnique({ where: { id } })
    );

    expect(found).toBeNull();
  });

  it('sin contexto de usuario, las políticas no permiten acceso', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;

      return tx.profile.findMany({
        where: { id: USER_A }
      });
    });

    expect(rows).toHaveLength(0);
  });

  it('crea el perfil mediante el trigger on_auth_user_created', async () => {
    const id = randomUUID();
    const email = `rls-trigger-${id}@example.test`;

    try {
      await admin.query(
        `
          INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
          )
          VALUES (
            '00000000-0000-0000-0000-000000000000',
            $1,
            'authenticated',
            'authenticated',
            $2,
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            $3::jsonb,
            now(),
            now()
          )
        `,
        [
          id,
          email,
          JSON.stringify({ display_name: 'Perfil creado por trigger' })
        ]
      );

      const profile = await admin.query(
        `
          SELECT id, display_name, created_at, updated_at
          FROM public.profiles
          WHERE id = $1
        `,
        [id]
      );

      expect(profile.rowCount).toBe(1);
      expect(profile.rows[0].display_name).toBe('Perfil creado por trigger');
      expect(profile.rows[0].created_at).not.toBeNull();
      expect(profile.rows[0].updated_at).not.toBeNull();
    } finally {
      await admin.query('DELETE FROM auth.users WHERE id = $1', [id]);
    }
  });
});
