import { Prisma, type User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types';

export async function ensureActor(
  prisma: PrismaService,
  actor: AuthenticatedUser,
): Promise<User> {
  if (!actor.isDemo) {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
    });

    if (!user) {
      throw new Error('Authenticated user does not exist.');
    }

    return user;
  }

  const existingDemoUser = await prisma.user.findUnique({
    where: { email: actor.email },
  });

  if (existingDemoUser) {
    return existingDemoUser;
  }

  try {
    return await prisma.user.create({
      data: {
        email: actor.email,
        name: 'Demo User',
        passwordHash: 'demo-bypass',
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const createdByParallelRequest = await prisma.user.findUnique({
        where: { email: actor.email },
      });

      if (createdByParallelRequest) {
        return createdByParallelRequest;
      }
    }

    throw error;
  }
}
