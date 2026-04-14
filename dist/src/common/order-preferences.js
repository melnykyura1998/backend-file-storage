"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyGroupedOrderPreferences = applyGroupedOrderPreferences;
exports.persistOrderPreferences = persistOrderPreferences;
function applyGroupedOrderPreferences(items, preferences, resourceType, getParentId) {
    const relevantPreferences = preferences.filter((preference) => preference.resourceType === resourceType);
    const preferenceMap = new Map(relevantPreferences.map((preference) => [
        preference.resourceId,
        preference.position,
    ]));
    const groupedItems = new Map();
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
async function persistOrderPreferences(prisma, userId, resourceType, parentId, items) {
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
//# sourceMappingURL=order-preferences.js.map