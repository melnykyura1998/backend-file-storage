import type { AuthenticatedUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
export declare class SearchController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    search(actor: AuthenticatedUser, query: string): Promise<{
        folders: {
            id: string;
            name: string;
            parentId: string | null;
            position: number;
            isPublic: boolean;
            updatedAt: Date;
        }[];
        files: {
            id: string;
            name: string;
            folderId: string | null;
            position: number;
            isPublic: boolean;
            mimeType: string;
            size: number;
            updatedAt: Date;
            url: string;
        }[];
    }>;
}
