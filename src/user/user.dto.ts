import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { User } from 'generated/prisma/client';

export type UserDto = User;

export class CreateOrUpdateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}(T.*Z)?$/, {
    message: 'Birthday must be in full ISO format (e.g. 1990-12-25)',
  })
  birthDate: string;

  @IsNotEmpty()
  timezone: string;
}
