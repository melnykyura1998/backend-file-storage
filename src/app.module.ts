import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth/auth.controller';
import { ApiAuthGuard } from './auth/auth.guard';
import { FilesController } from './files/files.controller';
import { FoldersController } from './folders/folders.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SearchController } from './search/search.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    JwtModule.register({}),
  ],
  controllers: [
    AuthController,
    FoldersController,
    FilesController,
    SearchController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard,
    },
  ],
})
export class AppModule {}
