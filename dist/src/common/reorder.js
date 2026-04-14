"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveItem = moveItem;
function moveItem(items, itemId, direction) {
    const ordered = [...items].sort((left, right) => left.position - right.position);
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
//# sourceMappingURL=reorder.js.map