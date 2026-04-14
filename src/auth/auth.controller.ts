import {
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './auth.dto';
import { Public } from './public.decorator';
import type { AuthenticatedUser } from './types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() body: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists.');
    }

    const passwordHash = await hash(body.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name.trim(),
        passwordHash,
      },
    });

    return this.createAuthResponse(user.id, user.email, user.name);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(@Body() body: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    const isPasswordValid = await compare(body.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }

    return this.createAuthResponse(user.id, user.email, user.name);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Returns the authenticated user.' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    if (user.isDemo) {
      return {
        id: 'demo-user',
        email: 'demo@example.com',
        name: 'Demo User',
        isDemo: true,
      };
    }

    const storedUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return {
      ...storedUser,
      isDemo: false,
    };
  }

  private async createAuthResponse(
    userId: string,
    email: string,
    name: string,
  ) {
    const token = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
      },
      {
        secret: process.env.JWT_SECRET ?? 'super-secret-demo-key',
        expiresIn: '1d',
      },
    );

    return {
      token,
      demoToken: process.env.DEMO_BEARER_TOKEN ?? 'demo-drive-token',
      user: {
        id: userId,
        email,
        name,
        isDemo: false,
      },
    };
  }
}
