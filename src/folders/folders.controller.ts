import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  PermissionRole,
  ResourceType,
  type FileEntry,
  type Prisma,
  type Folder,
} from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import { ensureActor } from '../common/actor';
import {
  applyGroupedOrderPreferences,
  persistOrderPreferences,
} from '../common/order-preferences';
import { canEditResource, canViewResource } from '../common/permissions';
import { moveItem } from '../common/reorder';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto, MoveFolderDto, UpdateFolderDto } from './folders.dto';

interface TreeNode {
  id: string;
  name: string;
  parentId: string | null;
  isPublic: boolean;
  position: number;
  fileCount: number;
  children: TreeNode[];
}

type TreeFile = Prisma.FileEntryGetPayload<{
  select: {
    id: true;
    folderId: true;
    ownerId: true;
    isPublic: true;
  };
}>;

@ApiTags('folders')
@ApiBearerAuth()
@Controller('folders')
export class FoldersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Get the visible folder tree for the current user' })
  async getTree(@CurrentUser() actor: AuthenticatedUser) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });

    const [folders, files, orderPreferences] = await Promise.all([
      this.prisma.folder.findMany({
        orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
      }),
      this.prisma.fileEntry.findMany({
        select: {
          id: true,
          folderId: true,
          ownerId: true,
          isPublic: true,
        },
      }),
      this.prisma.orderPreference.findMany({
        where: {
          userId: user.id,
          resourceType: ResourceType.FOLDER,
        },
      }),
    ]);

    const visibleFolders = folders.filter((folder) =>
      canViewResource(
        permissions,
        ResourceType.FOLDER,
        folder.id,
        user.id,
        folder.ownerId,
        folder.isPublic,
      ),
    );

    const visibleFiles = files.filter((file) =>
      canViewResource(
        permissions,
        ResourceType.FILE,
        file.id,
        user.id,
        file.ownerId,
        file.isPublic,
      ),
    );

    const orderedFolders = applyGroupedOrderPreferences(
      visibleFolders,
      orderPreferences,
      ResourceType.FOLDER,
      (folder) => folder.parentId,
    );

    return {
      folders: buildFolderTree(orderedFolders, visibleFiles),
    };
  }

  @Get('items')
  @ApiOperation({
    summary: 'List folders and files for a folder or root level',
  })
  @ApiQuery({ name: 'parentId', required: false, type: String })
  async getItems(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('parentId') parentId?: string,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });

    let currentFolder: Folder | null = null;
    if (parentId) {
      currentFolder = await this.prisma.folder.findUnique({
        where: { id: parentId },
      });

      if (!currentFolder) {
        throw new NotFoundException('Folder not found.');
      }

      this.assertFolderView(currentFolder, permissions, user.id);
    }

    const [folders, files, allFolders, orderPreferences] = await Promise.all([
      this.prisma.folder.findMany({
        where: { parentId: parentId ?? null },
        orderBy: { position: 'asc' },
      }),
      this.prisma.fileEntry.findMany({
        where: { folderId: parentId ?? null },
        orderBy: { position: 'asc' },
      }),
      this.prisma.folder.findMany(),
      this.prisma.orderPreference.findMany({
        where: {
          userId: user.id,
          parentId: parentId ?? null,
        },
      }),
    ]);

    const visibleFolders = folders.filter((folder) => {
      return canViewResource(
        permissions,
        ResourceType.FOLDER,
        folder.id,
        user.id,
        folder.ownerId,
        folder.isPublic,
      );
    });
    const visibleFiles = files.filter((file) => {
      return canViewResource(
        permissions,
        ResourceType.FILE,
        file.id,
        user.id,
        file.ownerId,
        file.isPublic,
      );
    });

    const orderedFolders = applyGroupedOrderPreferences(
      visibleFolders,
      orderPreferences,
      ResourceType.FOLDER,
      (folder) => folder.parentId,
    );
    const orderedFiles = applyGroupedOrderPreferences(
      visibleFiles,
      orderPreferences,
      ResourceType.FILE,
      (file) => file.folderId,
    );

    return {
      parent: currentFolder ? this.presentFolder(currentFolder) : null,
      breadcrumbs: currentFolder
        ? buildBreadcrumbs(currentFolder, allFolders).map((folder) =>
            this.presentFolder(folder),
          )
        : [],
      folders: orderedFolders.map((folder) => this.presentFolder(folder)),
      files: orderedFiles.map((file) => this.presentFile(file)),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a folder' })
  async createFolder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateFolderDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });

    if (body.parentId) {
      const parentFolder = await this.prisma.folder.findUnique({
        where: { id: body.parentId },
      });

      if (!parentFolder) {
        throw new NotFoundException('Parent folder not found.');
      }

      this.assertFolderEdit(parentFolder, permissions, user.id);
    }

    const position = await this.prisma.folder.count({
      where: { parentId: body.parentId ?? null },
    });

    const folder = await this.prisma.folder.create({
      data: {
        name: body.name.trim(),
        parentId: body.parentId ?? null,
        ownerId: user.id,
        position,
      },
    });

    await this.prisma.permission.create({
      data: {
        resourceType: ResourceType.FOLDER,
        resourceId: folder.id,
        role: PermissionRole.OWNER,
        userId: user.id,
      },
    });

    return this.presentFolder(folder);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a folder or change visibility' })
  async updateFolder(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateFolderDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const folder = await this.getFolderOrThrow(id);
    this.assertFolderEdit(folder, permissions, user.id);

    const updatedFolder = await this.prisma.folder.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(typeof body.isPublic === 'boolean'
          ? { isPublic: body.isPublic }
          : {}),
      },
    });

    return this.presentFolder(updatedFolder);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a folder recursively' })
  async deleteFolder(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const folder = await this.getFolderOrThrow(id);
    this.assertFolderEdit(folder, permissions, user.id);

    const allFolders = await this.prisma.folder.findMany();
    const descendantIds = collectDescendantFolderIds(id, allFolders);
    const folderIdsToDelete = [id, ...descendantIds];
    const filesToDelete = await this.prisma.fileEntry.findMany({
      where: {
        OR: [
          { folderId: { in: folderIdsToDelete } },
          { folderId: null, id: '___never___' },
        ],
      },
    });

    await this.prisma.$transaction(async (transaction) => {
      if (filesToDelete.length > 0) {
        await transaction.permission.deleteMany({
          where: {
            resourceType: ResourceType.FILE,
            resourceId: { in: filesToDelete.map((file) => file.id) },
          },
        });
        await transaction.fileEntry.deleteMany({
          where: {
            id: { in: filesToDelete.map((file) => file.id) },
          },
        });
      }

      await transaction.permission.deleteMany({
        where: {
          resourceType: ResourceType.FOLDER,
          resourceId: { in: folderIdsToDelete },
        },
      });

      for (const folderId of [...folderIdsToDelete].reverse()) {
        await transaction.folder.delete({
          where: { id: folderId },
        });
      }
    });

    return { success: true };
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone a folder recursively' })
  async cloneFolder(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const folder = await this.getFolderOrThrow(id);
    this.assertFolderEdit(folder, permissions, user.id);

    const clonedFolder = await this.cloneFolderRecursive(
      folder.id,
      folder.parentId,
      user.id,
      true,
    );
    return this.presentFolder(clonedFolder);
  }

  @Post(':id/move')
  @ApiOperation({
    summary: 'Move a folder up or down inside the current parent',
  })
  async moveFolder(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MoveFolderDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const folder = await this.getFolderOrThrow(id);
    const canEdit = canEditResource(
      permissions,
      ResourceType.FOLDER,
      folder.id,
      user.id,
      folder.ownerId,
    );

    const siblings = await this.prisma.folder.findMany({
      where: { parentId: folder.parentId },
      orderBy: { position: 'asc' },
    });

    if (canEdit) {
      const reordered = moveItem(siblings, id, body.direction);
      await this.prisma.$transaction(
        reordered.map((item) =>
          this.prisma.folder.update({
            where: { id: item.id },
            data: { position: item.position },
          }),
        ),
      );

      return { success: true };
    }

    this.assertFolderView(folder, permissions, user.id);

    if (!folder.isPublic) {
      throw new ForbiddenException(
        'You do not have edit access to this folder.',
      );
    }

    const orderPreferences = await this.prisma.orderPreference.findMany({
      where: {
        userId: user.id,
        resourceType: ResourceType.FOLDER,
        parentId: folder.parentId,
      },
    });
    const visibleSiblings = siblings.filter((sibling) =>
      canViewResource(
        permissions,
        ResourceType.FOLDER,
        sibling.id,
        user.id,
        sibling.ownerId,
        sibling.isPublic,
      ),
    );
    const orderedSiblings = applyGroupedOrderPreferences(
      visibleSiblings,
      orderPreferences,
      ResourceType.FOLDER,
      (item) => item.parentId,
    );
    const reordered = moveItem(orderedSiblings, id, body.direction);
    await persistOrderPreferences(
      this.prisma,
      user.id,
      ResourceType.FOLDER,
      folder.parentId,
      reordered,
    );

    return { success: true };
  }

  private async cloneFolderRecursive(
    sourceFolderId: string,
    targetParentId: string | null,
    actorId: string,
    renameRoot: boolean,
  ): Promise<Folder> {
    const sourceFolder = await this.getFolderOrThrow(sourceFolderId);
    const position = await this.prisma.folder.count({
      where: { parentId: targetParentId },
    });

    const createdFolder = await this.prisma.folder.create({
      data: {
        name: renameRoot ? `${sourceFolder.name} Copy` : sourceFolder.name,
        parentId: targetParentId,
        ownerId: actorId,
        isPublic: sourceFolder.isPublic,
        position,
      },
    });

    await this.prisma.permission.create({
      data: {
        resourceType: ResourceType.FOLDER,
        resourceId: createdFolder.id,
        role: PermissionRole.OWNER,
        userId: actorId,
      },
    });

    const [childFolders, childFiles] = await Promise.all([
      this.prisma.folder.findMany({
        where: { parentId: sourceFolderId },
        orderBy: { position: 'asc' },
      }),
      this.prisma.fileEntry.findMany({
        where: { folderId: sourceFolderId },
        orderBy: { position: 'asc' },
      }),
    ]);

    for (const file of childFiles) {
      const clonedFile = await this.prisma.fileEntry.create({
        data: {
          ownerId: actorId,
          folderId: createdFolder.id,
          name: `${file.name} Copy`,
          mimeType: file.mimeType,
          size: file.size,
          data: requireFileData(file),
          isPublic: file.isPublic,
          position: file.position,
        },
      });

      await this.prisma.permission.create({
        data: {
          resourceType: ResourceType.FILE,
          resourceId: clonedFile.id,
          role: PermissionRole.OWNER,
          userId: actorId,
        },
      });
    }

    for (const childFolder of childFolders) {
      await this.cloneFolderRecursive(
        childFolder.id,
        createdFolder.id,
        actorId,
        false,
      );
    }

    return createdFolder;
  }

  private async getFolderOrThrow(id: string): Promise<Folder> {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found.');
    }

    return folder;
  }

  private assertFolderView(
    folder: Folder,
    permissions: Array<{
      resourceType: ResourceType;
      resourceId: string;
      userId: string;
      role: PermissionRole;
    }>,
    userId: string,
  ) {
    const canView = canViewResource(
      permissions,
      ResourceType.FOLDER,
      folder.id,
      userId,
      folder.ownerId,
      folder.isPublic,
    );

    if (!canView) {
      throw new ForbiddenException('You do not have access to this folder.');
    }
  }

  private assertFolderEdit(
    folder: Folder,
    permissions: Array<{
      resourceType: ResourceType;
      resourceId: string;
      userId: string;
      role: PermissionRole;
    }>,
    userId: string,
  ) {
    const canEdit = canEditResource(
      permissions,
      ResourceType.FOLDER,
      folder.id,
      userId,
      folder.ownerId,
    );

    if (!canEdit) {
      throw new ForbiddenException(
        'You do not have edit access to this folder.',
      );
    }
  }

  private presentFolder(folder: Folder) {
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      position: folder.position,
      isPublic: folder.isPublic,
      ownerId: folder.ownerId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    };
  }

  private presentFile(file: FileEntry) {
    return {
      id: file.id,
      name: file.name,
      folderId: file.folderId,
      position: file.position,
      isPublic: file.isPublic,
      ownerId: file.ownerId,
      mimeType: file.mimeType,
      size: file.size,
      url: buildDataUrl(file.mimeType, file.data),
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}

function collectDescendantFolderIds(
  folderId: string,
  folders: Folder[],
): string[] {
  const children = folders.filter((folder) => folder.parentId === folderId);

  return children.flatMap((child) => [
    child.id,
    ...collectDescendantFolderIds(child.id, folders),
  ]);
}

function buildBreadcrumbs(
  currentFolder: Folder,
  allFolders: Folder[],
): Folder[] {
  const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
  const breadcrumbs: Folder[] = [];
  let cursor: Folder | undefined = currentFolder;

  while (cursor) {
    breadcrumbs.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return breadcrumbs;
}

function buildFolderTree(folders: Folder[], files: TreeFile[]): TreeNode[] {
  const childrenByParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const entry = childrenByParent.get(folder.parentId) ?? [];
    entry.push(folder);
    childrenByParent.set(folder.parentId, entry);
  }

  const fileCountByFolder = new Map<string, number>();
  for (const file of files) {
    if (!file.folderId) {
      continue;
    }

    fileCountByFolder.set(
      file.folderId,
      (fileCountByFolder.get(file.folderId) ?? 0) + 1,
    );
  }

  const buildNode = (folder: Folder): TreeNode => ({
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    isPublic: folder.isPublic,
    position: folder.position,
    fileCount: fileCountByFolder.get(folder.id) ?? 0,
    children: (childrenByParent.get(folder.id) ?? [])
      .sort((left, right) => left.position - right.position)
      .map(buildNode),
  });

  return (childrenByParent.get(null) ?? [])
    .sort((left, right) => left.position - right.position)
    .map(buildNode);
}

function buildDataUrl(mimeType: string, data: Uint8Array | null): string {
  if (!data) {
    return '';
  }

  return `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
}

function requireFileData(file: FileEntry): Uint8Array<ArrayBuffer> {
  if (!file.data) {
    throw new NotFoundException('File content is not available.');
  }

  const copy = new Uint8Array(file.data.byteLength);
  copy.set(file.data);
  return copy as Uint8Array<ArrayBuffer>;
}
