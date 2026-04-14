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
exports.FoldersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const actor_1 = require("../common/actor");
const order_preferences_1 = require("../common/order-preferences");
const permissions_1 = require("../common/permissions");
const reorder_1 = require("../common/reorder");
const prisma_service_1 = require("../prisma/prisma.service");
const folders_dto_1 = require("./folders.dto");
let FoldersController = class FoldersController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTree(actor) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
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
                    resourceType: client_1.ResourceType.FOLDER,
                },
            }),
        ]);
        const visibleFolders = folders.filter((folder) => (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FOLDER, folder.id, user.id, folder.ownerId, folder.isPublic));
        const visibleFiles = files.filter((file) => (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FILE, file.id, user.id, file.ownerId, file.isPublic));
        const orderedFolders = (0, order_preferences_1.applyGroupedOrderPreferences)(visibleFolders, orderPreferences, client_1.ResourceType.FOLDER, (folder) => folder.parentId);
        return {
            folders: buildFolderTree(orderedFolders, visibleFiles),
        };
    }
    async getItems(actor, parentId) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        let currentFolder = null;
        if (parentId) {
            currentFolder = await this.prisma.folder.findUnique({
                where: { id: parentId },
            });
            if (!currentFolder) {
                throw new common_1.NotFoundException('Folder not found.');
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
            return (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FOLDER, folder.id, user.id, folder.ownerId, folder.isPublic);
        });
        const visibleFiles = files.filter((file) => {
            return (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FILE, file.id, user.id, file.ownerId, file.isPublic);
        });
        const orderedFolders = (0, order_preferences_1.applyGroupedOrderPreferences)(visibleFolders, orderPreferences, client_1.ResourceType.FOLDER, (folder) => folder.parentId);
        const orderedFiles = (0, order_preferences_1.applyGroupedOrderPreferences)(visibleFiles, orderPreferences, client_1.ResourceType.FILE, (file) => file.folderId);
        return {
            parent: currentFolder ? this.presentFolder(currentFolder) : null,
            breadcrumbs: currentFolder
                ? buildBreadcrumbs(currentFolder, allFolders).map((folder) => this.presentFolder(folder))
                : [],
            folders: orderedFolders.map((folder) => this.presentFolder(folder)),
            files: orderedFiles.map((file) => this.presentFile(file)),
        };
    }
    async createFolder(actor, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        if (body.parentId) {
            const parentFolder = await this.prisma.folder.findUnique({
                where: { id: body.parentId },
            });
            if (!parentFolder) {
                throw new common_1.NotFoundException('Parent folder not found.');
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
                resourceType: client_1.ResourceType.FOLDER,
                resourceId: folder.id,
                role: client_1.PermissionRole.OWNER,
                userId: user.id,
            },
        });
        return this.presentFolder(folder);
    }
    async updateFolder(actor, id, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
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
    async deleteFolder(actor, id) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
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
                        resourceType: client_1.ResourceType.FILE,
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
                    resourceType: client_1.ResourceType.FOLDER,
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
    async cloneFolder(actor, id) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        const folder = await this.getFolderOrThrow(id);
        this.assertFolderEdit(folder, permissions, user.id);
        const clonedFolder = await this.cloneFolderRecursive(folder.id, folder.parentId, user.id, true);
        return this.presentFolder(clonedFolder);
    }
    async moveFolder(actor, id, body) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
        const permissions = await this.prisma.permission.findMany({
            where: { userId: user.id },
        });
        const folder = await this.getFolderOrThrow(id);
        const canEdit = (0, permissions_1.canEditResource)(permissions, client_1.ResourceType.FOLDER, folder.id, user.id, folder.ownerId);
        const siblings = await this.prisma.folder.findMany({
            where: { parentId: folder.parentId },
            orderBy: { position: 'asc' },
        });
        if (canEdit) {
            const reordered = (0, reorder_1.moveItem)(siblings, id, body.direction);
            await this.prisma.$transaction(reordered.map((item) => this.prisma.folder.update({
                where: { id: item.id },
                data: { position: item.position },
            })));
            return { success: true };
        }
        this.assertFolderView(folder, permissions, user.id);
        if (!folder.isPublic) {
            throw new common_1.ForbiddenException('You do not have edit access to this folder.');
        }
        const orderPreferences = await this.prisma.orderPreference.findMany({
            where: {
                userId: user.id,
                resourceType: client_1.ResourceType.FOLDER,
                parentId: folder.parentId,
            },
        });
        const visibleSiblings = siblings.filter((sibling) => (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FOLDER, sibling.id, user.id, sibling.ownerId, sibling.isPublic));
        const orderedSiblings = (0, order_preferences_1.applyGroupedOrderPreferences)(visibleSiblings, orderPreferences, client_1.ResourceType.FOLDER, (item) => item.parentId);
        const reordered = (0, reorder_1.moveItem)(orderedSiblings, id, body.direction);
        await (0, order_preferences_1.persistOrderPreferences)(this.prisma, user.id, client_1.ResourceType.FOLDER, folder.parentId, reordered);
        return { success: true };
    }
    async cloneFolderRecursive(sourceFolderId, targetParentId, actorId, renameRoot) {
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
                resourceType: client_1.ResourceType.FOLDER,
                resourceId: createdFolder.id,
                role: client_1.PermissionRole.OWNER,
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
                    resourceType: client_1.ResourceType.FILE,
                    resourceId: clonedFile.id,
                    role: client_1.PermissionRole.OWNER,
                    userId: actorId,
                },
            });
        }
        for (const childFolder of childFolders) {
            await this.cloneFolderRecursive(childFolder.id, createdFolder.id, actorId, false);
        }
        return createdFolder;
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
    assertFolderView(folder, permissions, userId) {
        const canView = (0, permissions_1.canViewResource)(permissions, client_1.ResourceType.FOLDER, folder.id, userId, folder.ownerId, folder.isPublic);
        if (!canView) {
            throw new common_1.ForbiddenException('You do not have access to this folder.');
        }
    }
    assertFolderEdit(folder, permissions, userId) {
        const canEdit = (0, permissions_1.canEditResource)(permissions, client_1.ResourceType.FOLDER, folder.id, userId, folder.ownerId);
        if (!canEdit) {
            throw new common_1.ForbiddenException('You do not have edit access to this folder.');
        }
    }
    presentFolder(folder) {
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
exports.FoldersController = FoldersController;
__decorate([
    (0, common_1.Get)('tree'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the visible folder tree for the current user' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "getTree", null);
__decorate([
    (0, common_1.Get)('items'),
    (0, swagger_1.ApiOperation)({
        summary: 'List folders and files for a folder or root level',
    }),
    (0, swagger_1.ApiQuery)({ name: 'parentId', required: false, type: String }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('parentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "getItems", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a folder' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, folders_dto_1.CreateFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "createFolder", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Rename a folder or change visibility' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, folders_dto_1.UpdateFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "updateFolder", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a folder recursively' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "deleteFolder", null);
__decorate([
    (0, common_1.Post)(':id/clone'),
    (0, swagger_1.ApiOperation)({ summary: 'Clone a folder recursively' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "cloneFolder", null);
__decorate([
    (0, common_1.Post)(':id/move'),
    (0, swagger_1.ApiOperation)({
        summary: 'Move a folder up or down inside the current parent',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, folders_dto_1.MoveFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "moveFolder", null);
exports.FoldersController = FoldersController = __decorate([
    (0, swagger_1.ApiTags)('folders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('folders'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FoldersController);
function collectDescendantFolderIds(folderId, folders) {
    const children = folders.filter((folder) => folder.parentId === folderId);
    return children.flatMap((child) => [
        child.id,
        ...collectDescendantFolderIds(child.id, folders),
    ]);
}
function buildBreadcrumbs(currentFolder, allFolders) {
    const byId = new Map(allFolders.map((folder) => [folder.id, folder]));
    const breadcrumbs = [];
    let cursor = currentFolder;
    while (cursor) {
        breadcrumbs.unshift(cursor);
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return breadcrumbs;
}
function buildFolderTree(folders, files) {
    const childrenByParent = new Map();
    for (const folder of folders) {
        const entry = childrenByParent.get(folder.parentId) ?? [];
        entry.push(folder);
        childrenByParent.set(folder.parentId, entry);
    }
    const fileCountByFolder = new Map();
    for (const file of files) {
        if (!file.folderId) {
            continue;
        }
        fileCountByFolder.set(file.folderId, (fileCountByFolder.get(file.folderId) ?? 0) + 1);
    }
    const buildNode = (folder) => ({
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
//# sourceMappingURL=folders.controller.js.map