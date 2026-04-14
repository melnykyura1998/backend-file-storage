export type Direction = 'up' | 'down';
export interface PositionedItem {
    id: string;
    position: number;
}
export declare function moveItem<T extends PositionedItem>(items: T[], itemId: string, direction: Direction): T[];
