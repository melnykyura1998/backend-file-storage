import { PermissionRole, ResourceType } from '@prisma/client';
export interface PermissionLookup {
    resourceType: ResourceType;
    resourceId: string;
    userId: string;
    role: PermissionRole;
}
export declare function canViewResource(permissions: PermissionLookup[], resourceType: ResourceType, resourceId: string, userId: string, ownerId: string, isPublic: boolean): boolean;
export declare function canEditResource(permissions: PermissionLookup[], resourceType: ResourceType, resourceId: string, userId: string, ownerId: string): boolean;
