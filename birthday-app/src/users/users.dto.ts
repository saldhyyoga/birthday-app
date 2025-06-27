// src/users/dto/create-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsIanaTimezone } from 'src/utils/iana-validator';

export class CreateOrUpdateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}(T.*Z)?$/, {
    message: 'Birthday must be in full ISO format (e.g. 1990-12-25)',
  })
  birthday: string;

  @IsNotEmpty()
  @IsIanaTimezone()
  timezone: string;
}
