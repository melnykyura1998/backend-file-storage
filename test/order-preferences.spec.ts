import { strict as assert } from 'node:assert';
import { ResourceType } from '@prisma/client';
import { describe, it } from 'mocha';
import { applyGroupedOrderPreferences } from '../src/common/order-preferences';

describe('applyGroupedOrderPreferences', () => {
  it('applies per-user folder order inside the same parent group', () => {
    const result = applyGroupedOrderPreferences(
      [
        { id: 'folder-a', parentId: null, position: 0 },
        { id: 'folder-b', parentId: null, position: 1 },
      ],
      [
        {
          id: 'pref-1',
          userId: 'user-1',
          resourceType: ResourceType.FOLDER,
          resourceId: 'folder-b',
          parentId: null,
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'pref-2',
          userId: 'user-1',
          resourceType: ResourceType.FOLDER,
          resourceId: 'folder-a',
          parentId: null,
          position: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      ResourceType.FOLDER,
      (item) => item.parentId,
    );

    assert.deepEqual(result, [
      { id: 'folder-b', parentId: null, position: 0 },
      { id: 'folder-a', parentId: null, position: 1 },
    ]);
  });

  it('keeps file ordering scoped to its parent folder', () => {
    const result = applyGroupedOrderPreferences(
      [
        { id: 'file-a', folderId: 'folder-1', position: 0 },
        { id: 'file-b', folderId: 'folder-1', position: 1 },
        { id: 'file-c', folderId: 'folder-2', position: 0 },
      ],
      [
        {
          id: 'pref-3',
          userId: 'user-1',
          resourceType: ResourceType.FILE,
          resourceId: 'file-b',
          parentId: 'folder-1',
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      ResourceType.FILE,
      (item) => item.folderId,
    );

    assert.deepEqual(result, [
      { id: 'file-b', folderId: 'folder-1', position: 0 },
      { id: 'file-a', folderId: 'folder-1', position: 1 },
      { id: 'file-c', folderId: 'folder-2', position: 0 },
    ]);
  });
});
