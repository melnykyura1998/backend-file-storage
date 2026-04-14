export type Direction = 'up' | 'down';

export interface PositionedItem {
  id: string;
  position: number;
}

export function moveItem<T extends PositionedItem>(
  items: T[],
  itemId: string,
  direction: Direction,
): T[] {
  const ordered = [...items].sort(
    (left, right) => left.position - right.position,
  );
  const index = ordered.findIndex((item) => item.id === itemId);

  if (index === -1) {
    return ordered;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return ordered;
  }

  const current = ordered[index];
  ordered[index] = ordered[targetIndex];
  ordered[targetIndex] = current;

  return ordered.map((item, orderedIndex) => ({
    ...item,
    position: orderedIndex,
  }));
}
