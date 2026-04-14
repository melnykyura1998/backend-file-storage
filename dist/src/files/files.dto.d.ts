import type { Direction } from '../common/reorder';
export declare class UpdateFileDto {
    name?: string;
    isPublic?: boolean;
}
export declare class MoveFileDto {
    direction: Direction;
}
export declare class UploadFileDto {
    folderId?: string;
}
