import type { AuthenticatedUser } from '../auth/types';
import { ShareAccessDto } from '../common/share.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MoveFileDto, UpdateFileDto, UploadFileDto } from './files.dto';
export declare class FilesController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    uploadFile(actor: AuthenticatedUser, file: Express.Multer.File, body: UploadFileDto): Promise<{
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
    }>;
    updateFile(actor: AuthenticatedUser, id: string, body: UpdateFileDto): Promise<{
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
    }>;
    deleteFile(actor: AuthenticatedUser, id: string): Promise<{
        success: boolean;
    }>;
    cloneFile(actor: AuthenticatedUser, id: string): Promise<{
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
    }>;
    moveFile(actor: AuthenticatedUser, id: string, body: MoveFileDto): Promise<{
        success: boolean;
    }>;
    shareFile(actor: AuthenticatedUser, id: string, body: ShareAccessDto): Promise<{
        success: boolean;
        email: string;
        role: "EDITOR" | "VIEWER";
    }>;
    private getFileOrThrow;
    private getFolderOrThrow;
    private assertFolderEdit;
    private assertFileEdit;
    private presentFile;
}
