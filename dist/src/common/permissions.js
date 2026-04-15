"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canViewResource = canViewResource;
exports.canEditResource = canEditResource;
exports.buildVisibilityContext = buildVisibilityContext;
const client_1 = require("@prisma/client");
const VIEW_ROLES = new Set([
    client_1.PermissionRole.OWNER,
    client_1.PermissionRole.EDITOR,
    client_1.PermissionRole.VIEWER,
]);
const EDIT_ROLES = new Set([
    client_1.PermissionRole.OWNER,
    client_1.PermissionRole.EDITOR,
]);
function findPermission(permissions, resourceType, resourceId, userId) {
    return permissions.find((permission) => {
        return (permission.resourceType === resourceType &&
            permission.resourceId === resourceId &&
            permission.userId === userId);
    });
}
function canViewResource(permissions, resourceType, resourceId, userId, ownerId, isPublic) {
    if (ownerId === userId || isPublic) {
        return true;
    }
    const permission = findPermission(permissions, resourceType, resourceId, userId);
    return permission ? VIEW_ROLES.has(permission.role) : false;
}
function canEditResource(permissions, resourceType, resourceId, userId, ownerId) {
    if (ownerId === userId) {
        return true;
    }
    const permission = findPermission(permissions, resourceType, resourceId, userId);
    return permission ? EDIT_ROLES.has(permission.role) : false;
}
function buildVisibilityContext(permissions, folders, files, userId) {
    const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
    const childFoldersByParent = new Map();
    for (const folder of folders) {
        const siblings = childFoldersByParent.get(folder.parentId) ?? [];
        siblings.push(folder);
        childFoldersByParent.set(folder.parentId, siblings);
    }
    const directlyVisibleFolderIds = new Set(folders
        .filter((folder) => canViewResource(permissions, client_1.ResourceType.FOLDER, folder.id, userId, folder.ownerId, folder.isPublic))
        .map((folder) => folder.id));
    const directlyVisibleFiles = files.filter((file) => canViewResource(permissions, client_1.ResourceType.FILE, file.id, userId, file.ownerId, file.isPublic));
    const contentVisibleFolderIds = new Set();
    const pathVisibleFolderIds = new Set();
    const markAncestorsVisible = (folderId) => {
        let cursor = folderId ? foldersById.get(folderId) : undefined;
        while (cursor) {
            if (pathVisibleFolderIds.has(cursor.id)) {
                return;
            }
            pathVisibleFolderIds.add(cursor.id);
            cursor = cursor.parentId ? foldersById.get(cursor.parentId) : undefined;
        }
    };
    const markDescendantsVisible = (folderId) => {
        if (contentVisibleFolderIds.has(folderId)) {
            return;
        }
        contentVisibleFolderIds.add(folderId);
        const children = childFoldersByParent.get(folderId) ?? [];
        for (const child of children) {
            markDescendantsVisible(child.id);
        }
    };
    for (const folderId of directlyVisibleFolderIds) {
        markAncestorsVisible(folderId);
        markDescendantsVisible(folderId);
    }
    for (const file of directlyVisibleFiles) {
        markAncestorsVisible(file.folderId);
    }
    const visibleFolderIds = new Set([
        ...pathVisibleFolderIds,
        ...contentVisibleFolderIds,
    ]);
    const directlyVisibleFileIds = new Set(directlyVisibleFiles.map((file) => file.id));
    return {
        canViewFolder(folderId) {
            return visibleFolderIds.has(folderId);
        },
        canViewFile(file) {
            return (directlyVisibleFileIds.has(file.id) ||
                (file.folderId !== null && contentVisibleFolderIds.has(file.folderId)));
        },
    };
}
//# sourceMappingURL=permissions.js.map