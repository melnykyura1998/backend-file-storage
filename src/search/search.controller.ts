import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import { ensureActor } from '../common/actor';
import { canViewResource } from '../common/permissions';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Search folders and files by name' })
  @ApiQuery({ name: 'q', required: true, type: String })
  async search(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('q') query: string,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return {
        folders: [],
        files: [],
      };
    }

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: {
          name: {
            contains: trimmedQuery,
            mode: 'insensitive',
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.fileEntry.findMany({
        where: {
          name: {
            contains: trimmedQuery,
            mode: 'insensitive',
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      folders: folders
        .filter((folder) =>
          canViewResource(
            permissions,
            ResourceType.FOLDER,
            folder.id,
            user.id,
            folder.ownerId,
            folder.isPublic,
          ),
        )
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          position: folder.position,
          isPublic: folder.isPublic,
          updatedAt: folder.updatedAt,
        })),
      files: files
        .filter((file) =>
          canViewResource(
            permissions,
            ResourceType.FILE,
            file.id,
            user.id,
            file.ownerId,
            file.isPublic,
          ),
        )
        .map((file) => ({
          id: file.id,
          name: file.name,
          folderId: file.folderId,
          position: file.position,
          isPublic: file.isPublic,
          mimeType: file.mimeType,
          size: file.size,
          updatedAt: file.updatedAt,
          url: buildDataUrl(file.mimeType, file.data),
        })),
    };
  }
}

function buildDataUrl(mimeType: string, data: Uint8Array | null): string {
  if (!data) {
    return '';
  }

  return `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
}
