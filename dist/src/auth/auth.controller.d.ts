import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import type { AuthenticatedUser } from './types';
export declare class AuthController {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(body: RegisterDto): Promise<{
        token: string;
        demoToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            isDemo: boolean;
        };
    }>;
    login(body: LoginDto): Promise<{
        token: string;
        demoToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            isDemo: boolean;
        };
    }>;
    me(user: AuthenticatedUser): Promise<{
        isDemo: boolean;
        email?: string | undefined;
        name?: string | undefined;
        id?: string | undefined;
    }>;
    private createAuthResponse;
}
