import { ResourceType, type OrderPreference } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PositionedItem } from './reorder';
export interface GroupedItem extends PositionedItem {
    id: string;
}
export declare function applyGroupedOrderPreferences<T extends GroupedItem>(items: T[], preferences: OrderPreference[], resourceType: ResourceType, getParentId: (item: T) => string | null): T[];
export declare function persistOrderPreferences<T extends GroupedItem>(prisma: PrismaService, userId: string, resourceType: ResourceType, parentId: string | null, items: T[]): Promise<void>;
