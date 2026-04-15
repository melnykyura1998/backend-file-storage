"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const swagger_1 = require("@nestjs/swagger");
const bcrypt_1 = require("bcrypt");
const prisma_service_1 = require("../prisma/prisma.service");
const current_user_decorator_1 = require("./current-user.decorator");
const auth_dto_1 = require("./auth.dto");
const public_decorator_1 = require("./public.decorator");
let AuthController = class AuthController {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(body) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
        });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists.');
        }
        const passwordHash = await (0, bcrypt_1.hash)(body.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: body.email.toLowerCase(),
                name: body.name.trim(),
                passwordHash,
            },
        });
        return this.createAuthResponse(user.id, user.email, user.name);
    }
    async login(body) {
        const user = await this.prisma.user.findUnique({
            where: { email: body.email.toLowerCase() },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Email or password is incorrect.');
        }
        const isPasswordValid = await (0, bcrypt_1.compare)(body.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Email or password is incorrect.');
        }
        return this.createAuthResponse(user.id, user.email, user.name);
    }
    async me(user) {
        const storedUser = await this.prisma.user.findUnique({
            where: { id: user.userId },
            select: {
                id: true,
                email: true,
                name: true,
            },
        });
        return storedUser;
    }
    async createAuthResponse(userId, email, name) {
        const token = await this.jwtService.signAsync({
            sub: userId,
            email,
        }, {
            secret: process.env.JWT_SECRET ?? 'super-secret-demo-key',
            expiresIn: '1d',
        });
        return {
            token,
            user: {
                id: userId,
                email,
                name,
            },
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new user' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiOperation)({ summary: 'Sign in with email and password' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOkResponse)({ description: 'Returns the authenticated user.' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map