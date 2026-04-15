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

export function buildVisibilityContext(
  permissions: PermissionLookup[],
  folders: FolderVisibilityInput[],
  files: FileVisibilityInput[],
  userId: string,
) {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const childFoldersByParent = new Map<string | null, FolderVisibilityInput[]>();

  for (const folder of folders) {
    const siblings = childFoldersByParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    childFoldersByParent.set(folder.parentId, siblings);
  }

  const directlyVisibleFolderIds = new Set(
    folders
      .filter((folder) =>
        canViewResource(
          permissions,
          ResourceType.FOLDER,
          folder.id,
          userId,
          folder.ownerId,
          folder.isPublic,
        ),
      )
      .map((folder) => folder.id),
  );
  const directlyVisibleFiles = files.filter((file) =>
    canViewResource(
      permissions,
      ResourceType.FILE,
      file.id,
      userId,
      file.ownerId,
      file.isPublic,
    ),
  );

  const contentVisibleFolderIds = new Set<string>();
  const pathVisibleFolderIds = new Set<string>();

  const markAncestorsVisible = (folderId: string | null) => {
    let cursor = folderId ? foldersById.get(folderId) : undefined;

    while (cursor) {
      if (pathVisibleFolderIds.has(cursor.id)) {
        return;
      }

      pathVisibleFolderIds.add(cursor.id);
      cursor = cursor.parentId ? foldersById.get(cursor.parentId) : undefined;
    }
  };

  const markDescendantsVisible = (folderId: string) => {
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
    canViewFolder(folderId: string) {
      return visibleFolderIds.has(folderId);
    },
    canViewFile(file: FileVisibilityInput) {
      return (
        directlyVisibleFileIds.has(file.id) ||
        (file.folderId !== null && contentVisibleFolderIds.has(file.folderId))
      );
    },
  };
}
