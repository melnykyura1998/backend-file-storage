import { strict as assert } from 'node:assert';
import { PermissionRole, ResourceType } from '@prisma/client';
import { describe, it } from 'mocha';
import {
  buildVisibilityContext,
  canEditResource,
  canViewResource,
} from '../src/common/permissions';

describe('permissions helpers', () => {
  it('allows public resources to be viewed without explicit permission', () => {
    const result = canViewResource(
      [],
      ResourceType.FILE,
      'file-1',
      'viewer-1',
      'owner-1',
      true,
    );
    assert.equal(result, true);
  });

  it('allows editors to modify shared resources', () => {
    const result = canEditResource(
      [
        {
          resourceType: ResourceType.FOLDER,
          resourceId: 'folder-1',
          userId: 'editor-1',
          role: PermissionRole.EDITOR,
        },
      ],
      ResourceType.FOLDER,
      'folder-1',
      'editor-1',
      'owner-1',
    );

    assert.equal(result, true);
  });

  it('shows descendants of a public folder to other users', () => {
    const visibility = buildVisibilityContext(
      [],
      [
        {
          id: 'folder-public',
          parentId: null,
          ownerId: 'owner-1',
          isPublic: true,
        },
        {
          id: 'folder-child',
          parentId: 'folder-public',
          ownerId: 'owner-1',
          isPublic: false,
        },
      ],
      [
        {
          id: 'file-child',
          folderId: 'folder-child',
          ownerId: 'owner-1',
          isPublic: false,
        },
      ],
      'viewer-1',
    );

    assert.equal(visibility.canViewFolder('folder-public'), true);
    assert.equal(visibility.canViewFolder('folder-child'), true);
    assert.equal(
      visibility.canViewFile({
        id: 'file-child',
        folderId: 'folder-child',
        ownerId: 'owner-1',
        isPublic: false,
      }),
      true,
    );
  });

  it('reveals the folder path for a public file only', () => {
    const visibility = buildVisibilityContext(
      [],
      [
        {
          id: 'folder-root',
          parentId: null,
          ownerId: 'owner-1',
          isPublic: false,
        },
        {
          id: 'folder-visible-path',
          parentId: 'folder-root',
          ownerId: 'owner-1',
          isPublic: false,
        },
        {
          id: 'folder-hidden-sibling',
          parentId: 'folder-root',
          ownerId: 'owner-1',
          isPublic: false,
        },
      ],
      [
        {
          id: 'file-public',
          folderId: 'folder-visible-path',
          ownerId: 'owner-1',
          isPublic: true,
        },
        {
          id: 'file-hidden',
          folderId: 'folder-hidden-sibling',
          ownerId: 'owner-1',
          isPublic: false,
        },
      ],
      'viewer-1',
    );

    assert.equal(visibility.canViewFolder('folder-root'), true);
    assert.equal(visibility.canViewFolder('folder-visible-path'), true);
    assert.equal(visibility.canViewFolder('folder-hidden-sibling'), false);
    assert.equal(
      visibility.canViewFile({
        id: 'file-public',
        folderId: 'folder-visible-path',
        ownerId: 'owner-1',
        isPublic: true,
      }),
      true,
    );
    assert.equal(
      visibility.canViewFile({
        id: 'file-hidden',
        folderId: 'folder-hidden-sibling',
        ownerId: 'owner-1',
        isPublic: false,
      }),
      false,
    );
  });
});
