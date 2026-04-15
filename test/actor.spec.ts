import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import { ensureActor } from '../src/common/actor';

describe('ensureActor', () => {
  it('returns the stored authenticated user', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      passwordHash: 'hashed-password',
    };
    const prisma = {
      user: {
        findUnique: () => Promise.resolve(existingUser),
      },
    };

    const result = await ensureActor(prisma as never, {
      userId: 'user-1',
      email: 'user@example.com',
    });

    assert.equal(result.id, 'user-1');
  });

  it('throws when the authenticated user record is missing', async () => {
    const prisma = {
      user: {
        findUnique: () => Promise.resolve(null),
      },
    };

    await assert.rejects(
      () =>
        ensureActor(prisma as never, {
          userId: 'missing-user',
          email: 'missing@example.com',
        }),
      /Authenticated user does not exist\./,
    );
  });
});
