import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types';

export async function ensureActor(
  prisma: PrismaService,
  actor: AuthenticatedUser,
): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
  });

  if (!user) {
    throw new Error('Authenticated user does not exist.');
  }

  return user;
}
