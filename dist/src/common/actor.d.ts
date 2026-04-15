import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types';
export declare function ensureActor(prisma: PrismaService, actor: AuthenticatedUser): Promise<User>;
