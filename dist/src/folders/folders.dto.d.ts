import type { Direction } from '../common/reorder';
export declare class CreateFolderDto {
    name: string;
    parentId?: string;
}
export declare class UpdateFolderDto {
    name?: string;
    isPublic?: boolean;
}
export declare class MoveFolderDto {
    direction: Direction;
}
