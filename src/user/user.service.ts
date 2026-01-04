import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrUpdateUserDto, UserDto } from './user.dto';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);
  constructor(private readonly prismaService: PrismaService) {}

  private calculateNextBirthdayUtc(birthDate: Date, timezone: string): Date {
    const now = new Date();
    const thisYear = now.getFullYear();

    // create next birthday this year at 9 AM user local time
    const targetLocal = new Date(
      thisYear,
      birthDate.getMonth(),
      birthDate.getDate(),
      8,
      6,
      0,
      0, // 09:00:00
    );

    // if birthday this year already passed, move to next year
    if (targetLocal <= now) {
      targetLocal.setFullYear(thisYear + 1);
    }

    // convert local birthday time to UTC so it can be stored & compared
    const targetUtc = toZonedTime(targetLocal, timezone);

    return targetUtc;
  }

  async createUser(dto: CreateOrUpdateUserDto): Promise<UserDto> {
    const { email, firstName, lastName } = dto;

    const nextBirthdayAtUtc = this.calculateNextBirthdayUtc(
      new Date(dto.birthDate),
      dto.timezone,
    );

    return await this.prismaService.user.create({
      data: {
        email,
        firstName,
        lastName,
        birthDate: new Date(dto.birthDate),
        timezone: dto.timezone,
        nextBirthdayAtUtc,
      },
    });
  }

  async deleteUser(id: string): Promise<void> {
    await this.prismaService.user.delete({
      where: {
        id,
      },
    });
  }

  async updateUser(id: string, dto: CreateOrUpdateUserDto): Promise<UserDto> {
    const { email, firstName, lastName } = dto;

    const currentUser = await this.prismaService.user.findUniqueOrThrow({
      where: { id },
      select: {
        birthDate: true,
        timezone: true,
      },
    });

    const newBirthDate = new Date(dto.birthDate);
    const isBirthDateChanged =
      currentUser.birthDate.getTime() !== newBirthDate.getTime();
    const isTimezoneChanged = currentUser.timezone !== dto.timezone;

    // only recalculate if birthDate or timezone changed
    const nextBirthdayAtUtc =
      isBirthDateChanged || isTimezoneChanged
        ? this.calculateNextBirthdayUtc(newBirthDate, dto.timezone)
        : undefined;

    try {
      return await this.prismaService.user.update({
        where: { id },
        data: {
          email,
          firstName,
          lastName,
          birthDate: newBirthDate,
          timezone: dto.timezone,
          ...(nextBirthdayAtUtc !== undefined && { nextBirthdayAtUtc }),
        },
      });
    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw new InternalServerErrorException('Could not update user');
    }
  }
}
