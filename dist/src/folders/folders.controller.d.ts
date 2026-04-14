import type { AuthenticatedUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto, MoveFolderDto, UpdateFolderDto } from './folders.dto';
interface TreeNode {
    id: string;
    name: string;
    parentId: string | null;
    isPublic: boolean;
    position: number;
    fileCount: number;
    children: TreeNode[];
}
export declare class FoldersController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getTree(actor: AuthenticatedUser): Promise<{
        folders: TreeNode[];
    }>;
    getItems(actor: AuthenticatedUser, parentId?: string): Promise<{
        parent: {
            id: string;
            name: string;
            parentId: string | null;
            position: number;
            isPublic: boolean;
            ownerId: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
        breadcrumbs: {
            id: string;
            name: string;
            parentId: string | null;
            position: number;
            isPublic: boolean;
            ownerId: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        folders: {
            id: string;
            name: string;
            parentId: string | null;
            position: number;
            isPublic: boolean;
            ownerId: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
        files: {
            id: string;
            name: string;
            folderId: string | null;
            position: number;
            isPublic: boolean;
            ownerId: string;
            mimeType: string;
            size: number;
            url: string;
            createdAt: Date;
            updatedAt: Date;
        }[];
    }>;
    createFolder(actor: AuthenticatedUser, body: CreateFolderDto): Promise<{
        id: string;
        name: string;
        parentId: string | null;
        position: number;
        isPublic: boolean;
        ownerId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateFolder(actor: AuthenticatedUser, id: string, body: UpdateFolderDto): Promise<{
        id: string;
        name: string;
        parentId: string | null;
        position: number;
        isPublic: boolean;
        ownerId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteFolder(actor: AuthenticatedUser, id: string): Promise<{
        success: boolean;
    }>;
    cloneFolder(actor: AuthenticatedUser, id: string): Promise<{
        id: string;
        name: string;
        parentId: string | null;
        position: number;
        isPublic: boolean;
        ownerId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    moveFolder(actor: AuthenticatedUser, id: string, body: MoveFolderDto): Promise<{
        success: boolean;
    }>;
    private cloneFolderRecursive;
    private getFolderOrThrow;
    private assertFolderView;
    private assertFolderEdit;
    private presentFolder;
    private presentFile;
}
export {};
