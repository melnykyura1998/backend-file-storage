import { ApiProperty } from '@nestjs/swagger';
import { PermissionRole } from '@prisma/client';
import { IsEmail, IsIn } from 'class-validator';

export class ShareAccessDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: [PermissionRole.EDITOR, PermissionRole.VIEWER] })
  @IsIn([PermissionRole.EDITOR, PermissionRole.VIEWER])
  role!: 'EDITOR' | 'VIEWER';
}
