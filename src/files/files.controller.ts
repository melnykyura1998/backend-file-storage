import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  PermissionRole,
  ResourceType,
  type FileEntry,
  type Folder,
} from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import { ensureActor } from '../common/actor';
import {
  applyGroupedOrderPreferences,
  persistOrderPreferences,
} from '../common/order-preferences';
import { canEditResource, canViewResource } from '../common/permissions';
import { moveItem } from '../common/reorder';
import {
  createUploadErrorMessage,
  isAllowedImageMimeType,
} from '../common/upload';
import { ShareAccessDto } from '../common/share.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MoveFileDto, UpdateFileDto, UploadFileDto } from './files.dto';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folderId: {
          type: 'string',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload an image file into the drive' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_request, file, callback) => {
        if (!isAllowedImageMimeType(file.mimetype)) {
          callback(new Error(createUploadErrorMessage(file.mimetype)), false);
          return;
        }

        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });

    if (!file) {
      throw new NotFoundException('Image upload is required.');
    }

    if (body.folderId) {
      const folder = await this.getFolderOrThrow(body.folderId);
      this.assertFolderEdit(folder, permissions, user.id);
    }

    const position = await this.prisma.fileEntry.count({
      where: { folderId: body.folderId ?? null },
    });

    const createdFile = await this.prisma.fileEntry.create({
      data: {
        ownerId: user.id,
        folderId: body.folderId ?? null,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        data: Buffer.from(file.buffer),
        position,
      },
    });

    await this.prisma.permission.create({
      data: {
        resourceType: ResourceType.FILE,
        resourceId: createdFile.id,
        role: PermissionRole.OWNER,
        userId: user.id,
      },
    });

    return this.presentFile(createdFile);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a file or change visibility' })
  async updateFile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateFileDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const file = await this.getFileOrThrow(id);
    this.assertFileEdit(file, permissions, user.id);

    const updatedFile = await this.prisma.fileEntry.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(typeof body.isPublic === 'boolean'
          ? { isPublic: body.isPublic }
          : {}),
      },
    });

    return this.presentFile(updatedFile);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const file = await this.getFileOrThrow(id);
    this.assertFileEdit(file, permissions, user.id);

    await this.prisma.permission.deleteMany({
      where: {
        resourceType: ResourceType.FILE,
        resourceId: file.id,
      },
    });
    await this.prisma.fileEntry.delete({
      where: { id: file.id },
    });

    return { success: true };
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Clone a file' })
  async cloneFile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const file = await this.getFileOrThrow(id);
    this.assertFileEdit(file, permissions, user.id);

    const position = await this.prisma.fileEntry.count({
      where: { folderId: file.folderId },
    });
    const clonedFile = await this.prisma.fileEntry.create({
      data: {
        ownerId: user.id,
        folderId: file.folderId,
        name: `${file.name} Copy`,
        mimeType: file.mimeType,
        size: file.size,
        data: requireFileData(file),
        position,
        isPublic: file.isPublic,
      },
    });

    await this.prisma.permission.create({
      data: {
        resourceType: ResourceType.FILE,
        resourceId: clonedFile.id,
        role: PermissionRole.OWNER,
        userId: user.id,
      },
    });

    return this.presentFile(clonedFile);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move a file up or down inside the current folder' })
  async moveFile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MoveFileDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const file = await this.getFileOrThrow(id);
    const canEdit = canEditResource(
      permissions,
      ResourceType.FILE,
      file.id,
      user.id,
      file.ownerId,
    );

    const siblings = await this.prisma.fileEntry.findMany({
      where: { folderId: file.folderId },
      orderBy: { position: 'asc' },
    });

    if (canEdit) {
      const reordered = moveItem(siblings, id, body.direction);
      await this.prisma.$transaction(
        reordered.map((item) =>
          this.prisma.fileEntry.update({
            where: { id: item.id },
            data: { position: item.position },
          }),
        ),
      );

      return { success: true };
    }

    if (!file.isPublic) {
      throw new ForbiddenException('You do not have edit access to this file.');
    }

    const canView = canViewResource(
      permissions,
      ResourceType.FILE,
      file.id,
      user.id,
      file.ownerId,
      file.isPublic,
    );

    if (!canView) {
      throw new ForbiddenException('You do not have access to this file.');
    }

    const orderPreferences = await this.prisma.orderPreference.findMany({
      where: {
        userId: user.id,
        resourceType: ResourceType.FILE,
        parentId: file.folderId,
      },
    });
    const visibleSiblings = siblings.filter((sibling) =>
      canViewResource(
        permissions,
        ResourceType.FILE,
        sibling.id,
        user.id,
        sibling.ownerId,
        sibling.isPublic,
      ),
    );
    const orderedSiblings = applyGroupedOrderPreferences(
      visibleSiblings,
      orderPreferences,
      ResourceType.FILE,
      (item) => item.folderId,
    );
    const reordered = moveItem(orderedSiblings, id, body.direction);
    await persistOrderPreferences(
      this.prisma,
      user.id,
      ResourceType.FILE,
      file.folderId,
      reordered,
    );

    return { success: true };
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Grant file access to a user by email' })
  async shareFile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: ShareAccessDto,
  ) {
    const user = await ensureActor(this.prisma, actor);
    const permissions = await this.prisma.permission.findMany({
      where: { userId: user.id },
    });
    const file = await this.getFileOrThrow(id);
    this.assertFileEdit(file, permissions, user.id);

    const targetUser = await this.prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });

    if (!targetUser) {
      throw new NotFoundException('User with this email was not found.');
    }

    await this.prisma.permission.upsert({
      where: {
        resourceType_resourceId_userId: {
          resourceType: ResourceType.FILE,
          resourceId: file.id,
          userId: targetUser.id,
        },
      },
      update: {
        role: body.role,
      },
      create: {
        resourceType: ResourceType.FILE,
        resourceId: file.id,
        userId: targetUser.id,
        role: body.role,
      },
    });

    return {
      success: true,
      email: targetUser.email,
      role: body.role,
    };
  }

  private async getFileOrThrow(id: string): Promise<FileEntry> {
    const file = await this.prisma.fileEntry.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException('File not found.');
    }

    return file;
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

  private assertFileEdit(
    file: FileEntry,
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
      ResourceType.FILE,
      file.id,
      userId,
      file.ownerId,
    );

    if (!canEdit) {
      throw new ForbiddenException('You do not have edit access to this file.');
    }
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
  return copy;
}
