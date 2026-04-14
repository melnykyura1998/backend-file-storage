import { strict as assert } from 'node:assert';
import { Prisma } from '@prisma/client';
import { describe, it } from 'mocha';
import { ensureActor } from '../src/common/actor';

describe('ensureActor', () => {
  it('returns an existing demo user when it already exists', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash: 'demo-bypass',
    };
    const prisma = {
      user: {
        findUnique: () => Promise.resolve(existingUser),
        create: () => {
          throw new Error('create should not be called');
        },
      },
    };

    const result = await ensureActor(prisma as never, {
      userId: 'demo-user',
      email: 'demo@example.com',
      isDemo: true,
    });

    assert.equal(result.id, 'user-1');
  });

  it('handles parallel demo-user creation gracefully', async () => {
    const createdUser = {
      id: 'user-2',
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash: 'demo-bypass',
    };
    let findCallCount = 0;
    const prisma = {
      user: {
        findUnique: () => {
          findCallCount += 1;
          return Promise.resolve(findCallCount === 1 ? null : createdUser);
        },
        create: () => {
          throw new Prisma.PrismaClientKnownRequestError('duplicate', {
            clientVersion: '7.7.0',
            code: 'P2002',
          });
        },
      },
    };

    const result = await ensureActor(prisma as never, {
      userId: 'demo-user',
      email: 'demo@example.com',
      isDemo: true,
    });

    assert.equal(result.id, 'user-2');
  });
});
