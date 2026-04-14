"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canViewResource = canViewResource;
exports.canEditResource = canEditResource;
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
//# sourceMappingURL=permissions.js.map