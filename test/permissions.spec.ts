import { strict as assert } from 'node:assert';
import { PermissionRole, ResourceType } from '@prisma/client';
import { describe, it } from 'mocha';
import { canEditResource, canViewResource } from '../src/common/permissions';

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
});
