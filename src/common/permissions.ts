import { PermissionRole, ResourceType } from '@prisma/client';

export interface PermissionLookup {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  role: PermissionRole;
}

const VIEW_ROLES = new Set<PermissionRole>([
  PermissionRole.OWNER,
  PermissionRole.EDITOR,
  PermissionRole.VIEWER,
]);

const EDIT_ROLES = new Set<PermissionRole>([
  PermissionRole.OWNER,
  PermissionRole.EDITOR,
]);

function findPermission(
  permissions: PermissionLookup[],
  resourceType: ResourceType,
  resourceId: string,
  userId: string,
): PermissionLookup | undefined {
  return permissions.find((permission) => {
    return (
      permission.resourceType === resourceType &&
      permission.resourceId === resourceId &&
      permission.userId === userId
    );
  });
}

export function canViewResource(
  permissions: PermissionLookup[],
  resourceType: ResourceType,
  resourceId: string,
  userId: string,
  ownerId: string,
  isPublic: boolean,
): boolean {
  if (ownerId === userId || isPublic) {
    return true;
  }

  const permission = findPermission(
    permissions,
    resourceType,
    resourceId,
    userId,
  );
  return permission ? VIEW_ROLES.has(permission.role) : false;
}

export function canEditResource(
  permissions: PermissionLookup[],
  resourceType: ResourceType,
  resourceId: string,
  userId: string,
  ownerId: string,
): boolean {
  if (ownerId === userId) {
    return true;
  }

  const permission = findPermission(
    permissions,
    resourceType,
    resourceId,
    userId,
  );
  return permission ? EDIT_ROLES.has(permission.role) : false;
}
