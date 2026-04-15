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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const core_1 = require("@nestjs/core");
const public_decorator_1 = require("./public.decorator");
let ApiAuthGuard = class ApiAuthGuard {
    reflector;
    jwtService;
    constructor(reflector, jwtService) {
        this.reflector = reflector;
        this.jwtService = jwtService;
    }
    async canActivate(context) {
        const isPublicRoute = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublicRoute) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const authorizationHeader = request.headers.authorization;
        if (!authorizationHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Bearer token is required.');
        }
        const token = authorizationHeader.replace('Bearer ', '').trim();
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.getJwtSecret(),
            });
            request.user = {
                userId: payload.sub,
                email: payload.email,
            };
            return true;
        }
        catch {
            throw new common_1.UnauthorizedException('Token is invalid or expired.');
        }
    }
    getJwtSecret() {
        return process.env.JWT_SECRET ?? 'super-secret-demo-key';
    }
};
exports.ApiAuthGuard = ApiAuthGuard;
exports.ApiAuthGuard = ApiAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        jwt_1.JwtService])
], ApiAuthGuard);
//# sourceMappingURL=auth.guard.js.map