"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const multer_1 = require("multer");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const actor_1 = require("../common/actor");
const order_preferences_1 = require("../common/order-preferences");
const permissions_1 = require("../common/permissions");
const reorder_1 = require("../common/reorder");
const upload_1 = require("../common/upload");
const share_dto_1 = require("../common/share.dto");
const prisma_service_1 = require("../prisma/prisma.service");
const files_dto_1 = require("./files.dto");
let FilesController = class FilesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async uploadFile(actor, file, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        if (!file) {
            throw new common_1.NotFoundException('Image upload is required.');
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
                resourceType: client_1.ResourceType.FILE,
                resourceId: createdFile.id,
                role: client_1.PermissionRole.OWNER,
                userId: user.id,
            },
        });
        return this.presentFile(createdFile);
    }
    async updateFile(actor, id, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
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
    async deleteFile(actor, id) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        const file = await this.getFileOrThrow(id);
        this.assertFileEdit(file, permissions, user.id);
        await this.prisma.permission.deleteMany({
            where: {
                resourceType: client_1.ResourceType.FILE,
                resourceId: file.id,
            },
        });
        await this.prisma.fileEntry.delete({
            where: { id: file.id },
        });
        return { success: true };
    }
    async cloneFile(actor, id) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
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
                resourceType: client_1.ResourceType.FILE,
                resourceId: clonedFile.id,
                role: client_1.PermissionRole.OWNER,
                userId: user.id,
            },
        });
        return this.presentFile(clonedFile);
    }
    async moveFile(actor, id, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        const file = await this.getFileOrThrow(id);
        const canEdit = (0, permissions_1.canEditResource)(permissions, client_1.ResourceType.FILE, file.id, user.id, file.ownerId);
        const siblings = await this.prisma.fileEntry.findMany({
            where: { folderId: file.folderId },
            orderBy: { position: 'asc' },
        });
        if (canEdit) {
            const reordered = (0, reorder_1.moveItem)(siblings, id, body.direction);
            await this.prisma.$transaction(reordered.map((item) => this.prisma.fileEntry.update({
                where: { id: item.id },
                data: { position: item.position },
            })));
            return { success: true };
        }
        if (!file.isPublic) {
            throw new common_1.ForbiddenException('You do not have edit access to this file.');
        }
        const canView = (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FILE, file.id, user.id, file.ownerId, file.isPublic);
        if (!canView) {
            throw new common_1.ForbiddenException('You do not have access to this file.');
        }
        const orderPreferences = await this.prisma.orderPreference.findMany({
            where: {
                userId: user.id,
                resourceType: client_1.ResourceType.FILE,
                parentId: file.folderId,
            },
        });
        const visibleSiblings = siblings.filter((sibling) => (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FILE, sibling.id, user.id, sibling.ownerId, sibling.isPublic));
        const orderedSiblings = (0, order_preferences_1.applyGroupedOrderPreferences)(visibleSiblings, orderPreferences, client_1.ResourceType.FILE, (item) => item.folderId);
        const reordered = (0, reorder_1.moveItem)(orderedSiblings, id, body.direction);
        await (0, order_preferences_1.persistOrderPreferences)(this.prisma, user.id, client_1.ResourceType.FILE, file.folderId, reordered);
        return { success: true };
    }
    async shareFile(actor, id, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        const file = await this.getFileOrThrow(id);
        this.assertFileEdit(file, permissions, user.id);
        const targetUser = await this.prisma.user.findUnique({
            where: { email: body.email.trim().toLowerCase() },
        });
        if (!targetUser) {
            throw new common_1.NotFoundException('User with this email was not found.');
        }
        await this.prisma.permission.upsert({
            where: {
                resourceType_resourceId_userId: {
                    resourceType: client_1.ResourceType.FILE,
                    resourceId: file.id,
                    userId: targetUser.id,
                },
            },
            update: {
                role: body.role,
            },
            create: {
                resourceType: client_1.ResourceType.FILE,
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
    async getFileOrThrow(id) {
        const file = await this.prisma.fileEntry.findUnique({
            where: { id },
        });
        if (!file) {
            throw new common_1.NotFoundException('File not found.');
        }
        return file;
    }
    async getFolderOrThrow(id) {
        const folder = await this.prisma.folder.findUnique({
            where: { id },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Folder not found.');
        }
        return folder;
    }
    assertFolderEdit(folder, permissions, userId) {
        const canEdit = (0, permissions_1.canEditResource)(permissions, client_1.ResourceType.FOLDER, folder.id, userId, folder.ownerId);
        if (!canEdit) {
            throw new common_1.ForbiddenException('You do not have edit access to this folder.');
        }
    }
    assertFileEdit(file, permissions, userId) {
        const canEdit = (0, permissions_1.canEditResource)(permissions, client_1.ResourceType.FILE, file.id, userId, file.ownerId);
        if (!canEdit) {
            throw new common_1.ForbiddenException('You do not have edit access to this file.');
        }
    }
    presentFile(file) {
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
};
exports.FilesController = FilesController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
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
    }),
    (0, swagger_1.ApiOperation)({ summary: 'Upload an image file into the drive' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        fileFilter: (_request, file, callback) => {
            if (!(0, upload_1.isAllowedImageMimeType)(file.mimetype)) {
                callback(new Error((0, upload_1.createUploadErrorMessage)(file.mimetype)), false);
                return;
            }
            callback(null, true);
        },
        limits: {
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, files_dto_1.UploadFileDto]),
    __metadata("design:returntype", Promise)
], FilesController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Rename a file or change visibility' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, files_dto_1.UpdateFileDto]),
    __metadata("design:returntype", Promise)
], FilesController.prototype, "updateFile", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a file' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FilesController.prototype, "deleteFile", null);
__decorate([
    (0, common_1.Post)(':id/clone'),
    (0, swagger_1.ApiOperation)({ summary: 'Clone a file' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FilesController.prototype, "cloneFile", null);
__decorate([
    (0, common_1.Post)(':id/move'),
    (0, swagger_1.ApiOperation)({ summary: 'Move a file up or down inside the current folder' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, files_dto_1.MoveFileDto]),
    __metadata("design:returntype", Promise)
], FilesController.prototype, "moveFile", null);
__decorate([
    (0, common_1.Post)(':id/share'),
    (0, swagger_1.ApiOperation)({ summary: 'Grant file access to a user by email' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, share_dto_1.ShareAccessDto]),
    __metadata("design:returntype", Promise)
], FilesController.prototype, "shareFile", null);
exports.FilesController = FilesController = __decorate([
    (0, swagger_1.ApiTags)('files'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('files'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FilesController);
function buildDataUrl(mimeType, data) {
    if (!data) {
        return '';
    }
    return `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
}
function requireFileData(file) {
    if (!file.data) {
        throw new common_1.NotFoundException('File content is not available.');
    }
    const copy = new Uint8Array(file.data.byteLength);
    copy.set(file.data);
    return copy;
}
//# sourceMappingURL=files.controller.js.map