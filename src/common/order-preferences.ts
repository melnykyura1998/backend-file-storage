import { ResourceType, type OrderPreference } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PositionedItem } from './reorder';

export interface GroupedItem extends PositionedItem {
  id: string;
}

export function applyGroupedOrderPreferences<T extends GroupedItem>(
  items: T[],
  preferences: OrderPreference[],
  resourceType: ResourceType,
  getParentId: (item: T) => string | null,
): T[] {
  const relevantPreferences = preferences.filter(
    (preference) => preference.resourceType === resourceType,
  );
  const preferenceMap = new Map(
    relevantPreferences.map((preference) => [
      preference.resourceId,
      preference.position,
    ]),
  );
  const groupedItems = new Map<string | null, T[]>();

  for (const item of items) {
    const parentId = getParentId(item);
    const existingItems = groupedItems.get(parentId) ?? [];
    existingItems.push(item);
    groupedItems.set(parentId, existingItems);
  }

  return [...groupedItems.values()].flatMap((grouped) => {
    return [...grouped]
      .sort((left, right) => {
        const leftPreference = preferenceMap.get(left.id);
        const rightPreference = preferenceMap.get(right.id);
        const leftPosition = leftPreference ?? left.position;
        const rightPosition = rightPreference ?? right.position;

        if (leftPosition !== rightPosition) {
          return leftPosition - rightPosition;
        }

        if (leftPreference !== undefined && rightPreference === undefined) {
          return -1;
        }

        if (leftPreference === undefined && rightPreference !== undefined) {
          return 1;
        }

        return left.id.localeCompare(right.id);
      })
      .map((item, index) => ({
        ...item,
        position: index,
      }));
  });
}

export async function persistOrderPreferences<T extends GroupedItem>(
  prisma: PrismaService,
  userId: string,
  resourceType: ResourceType,
  parentId: string | null,
  items: T[],
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.orderPreference.deleteMany({
      where: {
        userId,
        resourceType,
        parentId,
        resourceId: {
          in: items.map((item) => item.id),
        },
      },
    });

    await transaction.orderPreference.createMany({
      data: items.map((item) => ({
        userId,
        resourceType,
        resourceId: item.id,
        parentId,
        position: item.position,
      })),
    });
  });
}
