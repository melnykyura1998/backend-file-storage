import { PermissionRole, ResourceType } from '@prisma/client';
export interface PermissionLookup {
    resourceType: ResourceType;
    resourceId: string;
    userId: string;
    role: PermissionRole;
}
export declare function canViewResource(permissions: PermissionLookup[], resourceType: ResourceType, resourceId: string, userId: string, ownerId: string, isPublic: boolean): boolean;
export declare function canEditResource(permissions: PermissionLookup[], resourceType: ResourceType, resourceId: string, userId: string, ownerId: string): boolean;
interface FolderVisibilityInput {
    id: string;
    parentId: string | null;
    ownerId: string;
    isPublic: boolean;
}
interface FileVisibilityInput {
    id: string;
    folderId: string | null;
    ownerId: string;
    isPublic: boolean;
}
export declare function buildVisibilityContext(permissions: PermissionLookup[], folders: FolderVisibilityInput[], files: FileVisibilityInput[], userId: string): {
    canViewFolder(folderId: string): boolean;
    canViewFile(file: FileVisibilityInput): boolean;
};
export {};
