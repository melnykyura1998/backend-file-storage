import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedUser } from './types';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    const token = authorizationHeader.replace('Bearer ', '').trim();

    if (token === this.getDemoToken()) {
      request.user = {
        userId: 'demo-user',
        email: 'demo@example.com',
        isDemo: true,
      };

      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token, {
        secret: this.getJwtSecret(),
      });

      request.user = {
        userId: payload.sub,
        email: payload.email,
        isDemo: false,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token is invalid or expired.');
    }
  }

  private getDemoToken(): string {
    return process.env.DEMO_BEARER_TOKEN ?? 'demo-drive-token';
  }

  private getJwtSecret(): string {
    return process.env.JWT_SECRET ?? 'super-secret-demo-key';
  }
}
