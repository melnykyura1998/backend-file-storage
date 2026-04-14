import { strict as assert } from 'node:assert';
import { describe, it } from 'mocha';
import { moveItem } from '../src/common/reorder';

describe('moveItem', () => {
  it('moves an item upward and rewrites positions', () => {
    const result = moveItem(
      [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
        { id: 'c', position: 2 },
      ],
      'b',
      'up',
    );

    assert.deepEqual(result, [
      { id: 'b', position: 0 },
      { id: 'a', position: 1 },
      { id: 'c', position: 2 },
    ]);
  });

  it('does nothing when moving the first item up', () => {
    const result = moveItem(
      [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
      ],
      'a',
      'up',
    );

    assert.deepEqual(result, [
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
    ]);
  });
});
