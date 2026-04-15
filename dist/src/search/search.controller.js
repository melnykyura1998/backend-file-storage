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
exports.SearchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const actor_1 = require("../common/actor");
const permissions_1 = require("../common/permissions");
const prisma_service_1 = require("../prisma/prisma.service");
let SearchController = class SearchController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async search(actor, query) {
        const user = await (0, actor_1.ensureActor)(this.prisma, actor);
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
        const [folders, files, allFolders, allFiles] = await Promise.all([
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
            this.prisma.folder.findMany({
                select: {
                    id: true,
                    parentId: true,
                    ownerId: true,
                    isPublic: true,
                },
            }),
            this.prisma.fileEntry.findMany({
                select: {
                    id: true,
                    folderId: true,
                    ownerId: true,
                    isPublic: true,
                },
            }),
        ]);
        const visibility = (0, permissions_1.buildVisibilityContext)(permissions, allFolders, allFiles, user.id);
        return {
            folders: folders
                .filter((folder) => visibility.canViewFolder(folder.id))
                .map((folder) => ({
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId,
                position: folder.position,
                isPublic: folder.isPublic,
                updatedAt: folder.updatedAt,
            })),
            files: files
                .filter((file) => visibility.canViewFile(file))
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
};
exports.SearchController = SearchController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Search folders and files by name' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: true, type: String }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SearchController.prototype, "search", null);
exports.SearchController = SearchController = __decorate([
    (0, swagger_1.ApiTags)('search'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('search'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SearchController);
function buildDataUrl(mimeType, data) {
    if (!data) {
        return '';
    }
    return `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
}
//# sourceMappingURL=search.controller.js.map