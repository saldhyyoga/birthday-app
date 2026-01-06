import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrUpdateUserDto, UserDto } from './user.dto';
import { calculateNextBirthdayUtc } from '../utils/calculate-nextbirthday';
import { JobStatus, MessageType } from 'generated/prisma';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);
  constructor(private readonly prismaService: PrismaService) {}

  async createUser(dto: CreateOrUpdateUserDto): Promise<UserDto> {
    const { email, firstName, lastName } = dto;

    const nextBirthdayAtUtc = calculateNextBirthdayUtc(
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
    const needsReschedule = isBirthDateChanged || isTimezoneChanged;

    // Only recalculate if birthDate or timezone changed
    const nextBirthdayAtUtc = needsReschedule
      ? calculateNextBirthdayUtc(newBirthDate, dto.timezone)
      : undefined;

    try {
      // Use transaction to ensure atomicity
      return await this.prismaService.$transaction(async (tx) => {
        // If birthday schedule changed, delete pending jobs
        if (needsReschedule) {
          const deletedJobs = await tx.messageJob.deleteMany({
            where: {
              userId: id,
              type: MessageType.BIRTHDAY,
              status: {
                in: [JobStatus.PENDING, JobStatus.PROCESSING],
              },
            },
          });

          if (deletedJobs.count > 0) {
            this.logger.log(
              `Deleted ${deletedJobs.count} pending birthday job(s) for user ${id} due to schedule change`,
            );
          }
        }

        // Update user
        return await tx.user.update({
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
      });
    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw new InternalServerErrorException('Could not update user');
    }
  }
}
