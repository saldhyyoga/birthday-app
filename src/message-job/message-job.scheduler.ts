import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { addHours, endOfDay, startOfDay, subDays } from 'date-fns';
import { JobStatus, MessageType, Prisma } from 'generated/prisma';

@Injectable()
export class MessageJobScheduler {
  private readonly logger = new Logger(MessageJobScheduler.name);

  // recover jobs from yesterday if server crash 1 day
  private readonly RECOVERY_WINDOW_DAYS = 1;
  constructor(private readonly prismaService: PrismaService) {}

  private async createManyJobs(
    jobs: Prisma.MessageJobCreateManyInput[],
  ): Promise<void> {
    if (jobs.length === 0) return;
    try {
      await this.prismaService.messageJob.createMany({
        data: jobs,
        skipDuplicates: true,
      });
    } catch (error) {
      this.logger.log(`Error when create many jobs`, error);
    }
  }

  /**
   * Create jobs for users whose birthday ALREADY PASSED (missed)
   * Range: recoveryStartDate <= nextBirthdayAtUtc < now
   */
  private async createMissedBirthdayJobs(): Promise<
    Prisma.MessageJobCreateManyInput[]
  > {
    const now = new Date();
    const recoveryStartDate = subDays(now, this.RECOVERY_WINDOW_DAYS);

    const missedUsers = await this.prismaService.user.findMany({
      where: {
        nextBirthdayAtUtc: {
          gte: startOfDay(recoveryStartDate),
          lt: now,
        },
        messageJobs: {
          none: {
            type: MessageType.BIRTHDAY,
            scheduledAt: {
              gte: startOfDay(recoveryStartDate),
              lt: endOfDay(now),
            },
            status: {
              in: [JobStatus.DONE, JobStatus.PENDING, JobStatus.PROCESSING],
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        nextBirthdayAtUtc: true,
      },
    });

    if (missedUsers.length === 0) {
      this.logger.log('No missed birthday jobs to recover');
      return [];
    }

    const jobs: Prisma.MessageJobCreateManyInput[] = missedUsers.map(
      (user) => ({
        userId: user.id,
        type: MessageType.BIRTHDAY,
        scheduledAt: user.nextBirthdayAtUtc,
        status: JobStatus.PENDING,
        maxAttempts: 23,
      }),
    );

    this.logger.warn(
      `Created ${missedUsers.length} missed birthday jobs: ${missedUsers.map((u) => u.email).join(', ')}`,
    );

    return jobs;
  }

  /**
   * Create jobs for users whose birthday is UPCOMING (within next 24 hours)
   */
  private async createRegularBirthdayJobs(): Promise<
    Prisma.MessageJobCreateManyInput[]
  > {
    const now = new Date();
    const windowEndUtc = addHours(now, 24);

    // Regular = birthday BELUM lewat (nextBirthdayAtUtc >= now)
    const users = await this.prismaService.user.findMany({
      where: {
        nextBirthdayAtUtc: {
          gte: now,
          lt: windowEndUtc,
        },
        messageJobs: {
          none: {
            type: MessageType.BIRTHDAY,
            scheduledAt: {
              gte: now,
              lt: windowEndUtc,
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        nextBirthdayAtUtc: true,
      },
    });

    if (users.length === 0) return [];

    const jobs: Prisma.MessageJobCreateManyInput[] = users.map((user) => ({
      userId: user.id,
      type: MessageType.BIRTHDAY,
      scheduledAt: user.nextBirthdayAtUtc,
      status: JobStatus.PENDING,
      maxAttempts: 23,
    }));

    this.logger.log(
      `Scheduling ${jobs.length} regular birthday jobs for upcoming birthdays ${users.map((u) => u.email).join(', ')}`,
    );

    return jobs;
  }

  // run every hour
  @Cron('0 * * * *')
  async scheduleBirthdayJobs(): Promise<void> {
    this.logger.log('Starting to schedule birthday jobs...');

    const [regularJobs, missedJobs] = await Promise.all([
      this.createRegularBirthdayJobs(),
      this.createMissedBirthdayJobs(),
    ]);

    const allJobs = [...regularJobs, ...missedJobs];

    if (allJobs.length === 0) {
      this.logger.log('No birthday jobs to create');
      return;
    }

    await this.createManyJobs(allJobs);
  }
}
