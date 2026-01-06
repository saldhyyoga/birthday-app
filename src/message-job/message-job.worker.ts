import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { calculateNextBirthdayUtc } from 'src/utils/calculate-nextbirthday';
import { JobStatus, Prisma } from 'generated/prisma';
import { addMinutes } from 'date-fns';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MessageJobWorker {
  private readonly logger = new Logger(MessageJobWorker.name);
  private readonly BATCH_SIZE = 10;
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private async updateFailedOrPendingJob(
    job: {
      id: number;
      attempts: number;
      maxAttempts: number;
    },
    error: Error | string,
  ) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await this.prismaService.messageJob.update({
      where: { id: job.id },
      data: {
        attempts: { increment: 1 },
        status:
          job.attempts + 1 >= job.maxAttempts
            ? JobStatus.FAILED
            : JobStatus.PENDING,
        lastError: String(error),
        errorMessage,
      },
    });
  }

  private async processJob(job: {
    id: number;
    attempts: number;
    maxAttempts: number;
    user: {
      id: string;
      email: string;
      nextBirthdayAtUtc: Date;
      timezone: string;
      firstName: string;
      lastName: string;
    };
  }) {
    try {
      const emailSent = await this.mailService.sendBirthdayEmail(
        job.user.email,
        `${job.user.firstName} ${job.user.lastName}`,
      );

      if (emailSent) {
        const nextBirthdayAtUtc = calculateNextBirthdayUtc(
          job.user.nextBirthdayAtUtc,
          job.user.timezone,
        );

        await this.prismaService.$transaction([
          this.prismaService.messageJob.update({
            where: { id: job.id },
            data: {
              status: JobStatus.DONE,
              processedAt: new Date(),
              attempts: { increment: 1 },
            },
          }),
          this.prismaService.user.update({
            where: { id: job.user.id },
            data: { nextBirthdayAtUtc },
          }),
        ]);

        this.logger.log(
          `Processed message jobId:${job.id} for ${job.user.email}`,
        );
      } else {
        await this.updateFailedOrPendingJob(
          {
            id: job.id,
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
          },
          'Error send email',
        );

        throw new Error(`Email not sent for job ${job.id}`);
      }
    } catch (error) {
      const errorMessage = `Failed message job ${job.id} for ${job.user.email}: ${error.message}`;
      this.logger.error(errorMessage);

      await this.updateFailedOrPendingJob(
        {
          id: job.id,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
        },
        errorMessage,
      );

      throw new Error(`Email not sent for job ${job.id}`);
    }
  }

  /**
   * Fetch batch of pending jobs using cursor-based pagination
   */
  private async fetchPendingJobs(cursor?: number) {
    const now = new Date();
    const windowEnd = addMinutes(now, 2);

    // Step 1: Atomic claim - SELECT + UPDATE + LOCK in one query
    const claimedJobs = await this.prismaService.$queryRaw<
      Array<{
        id: number;
        attempts: number;
        maxAttempts: number;
        userId: string;
      }>
    >`
    UPDATE "MessageJob"
    SET 
      status = 'PROCESSING',
      "updatedAt" = NOW()
    WHERE id IN (
      SELECT id 
      FROM "MessageJob"
      WHERE status = 'PENDING'
        AND "scheduledAt" <= ${windowEnd}
        AND "processedAt" IS NULL
        AND attempts < 24
        ${cursor ? Prisma.sql`AND id > ${cursor}` : Prisma.empty}
      ORDER BY id ASC
      LIMIT ${this.BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, attempts, "maxAttempts", "userId"
  `;

    if (claimedJobs.length === 0) {
      return [];
    }

    // Step 2: Fetch user data for claimed jobs
    // Safe because jobs are now status = PROCESSING, cannot be claimed by other workers
    const jobIds = claimedJobs.map((j) => j.id);

    return this.prismaService.messageJob.findMany({
      where: {
        id: { in: jobIds },
      },
      select: {
        id: true,
        attempts: true,
        maxAttempts: true,
        user: {
          select: {
            id: true,
            nextBirthdayAtUtc: true,
            firstName: true,
            lastName: true,
            timezone: true,
            email: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Main cron handler - processes all pending birthday jobs.
   *
   * ## Flow:
   * 1. Count total pending jobs (for logging progress)
   * 2. Loop with cursor-based pagination:
   *    a. Claim batch of jobs (atomic)
   *    b. Process jobs concurrently with Promise.allSettled
   *    c. Update cursor to last processed job ID
   *    d. Repeat until no more jobs
   * 3. Log summary
   *
   * ## Cron Schedule: '15 * * * *'
   * - Runs at minute 15 of every hour
   * - Examples: 00:15, 01:15, 02:15, ...
   *
   * * ## Cron Schedule: Why Every 15 Minutes?
   *
   * The cron runs at minute 15 of every hour ('15 * * * *') to accommodate
   * **non-standard UTC offset timezones** that don't align with full hours.
   *
   * ### Standard Timezones (Full Hour Offsets):
   * - UTC+00:00 (London)
   * - UTC+07:00 (Jakarta)
   * - UTC+09:00 (Tokyo)
   * - UTC-05:00 (New York)
   *
   * ### Non-Standard Timezones (Partial Hour Offsets):
   * | Timezone        | UTC Offset | Region                    |
   * |-----------------|------------|---------------------------|
   * | Asia/Kathmandu  | +05:45     | Nepal                     |
   * | Asia/Kolkata    | +05:30     | India                     |
   * | Asia/Yangon     | +06:30     | Myanmar                   |
   * | Asia/Kabul      | +04:30     | Afghanistan               |
   * | Australia/Darwin| +09:30     | Northern Territory, AU    |
   * | Canada/Newfound | -03:30     | Newfoundland, Canada      |
   * | Pacific/Chatham | +12:45     | Chatham Islands, NZ       |
   * | Pacific/Marquesas| -09:30    | Marquesas Islands         |
   * @schedule Every hour at minute 15
   */
  @Cron('10 */15 * * * *')
  async handleBirthdayJobs(): Promise<void> {
    this.logger.log('Starting to process birthday jobs...');
    try {
      let totalProcessed = 0;
      let totalFailed = 0;
      let cursor: number | undefined = undefined;

      // first, count total jobs to process
      const now = new Date();
      const totalPendingJobs = await this.prismaService.messageJob.count({
        where: {
          status: JobStatus.PENDING,
          scheduledAt: {
            lte: addMinutes(now, 2),
          },
          processedAt: null,
          maxAttempts: {
            lt: 24,
          },
        },
      });

      if (totalPendingJobs === 0) {
        this.logger.log('No birthday jobs to process at this time.');
        return;
      }

      // process all jobs using cursor-based pagination
      while (true) {
        const jobs = await this.fetchPendingJobs(cursor);

        if (jobs.length === 0) {
          break;
        }

        this.logger.log(
          `Processing batch of ${jobs.length} jobs (cursor: ${cursor ?? 'start'})...`,
        );

        // use allSettled to process jobs in parallel, capture results and non-blocking failures
        const results = await Promise.allSettled(
          jobs.map((job) => this.processJob(job)),
        );

        // count successes and failures
        const succeeded = results.filter(
          (r) => r.status === 'fulfilled',
        ).length;

        totalProcessed += succeeded;
        totalFailed = jobs.length - succeeded;

        // update cursor to last job id
        cursor = jobs[jobs.length - 1].id;

        this.logger.log(
          `Batch complete: ${succeeded} succeeded, ${totalFailed} failed. Total processed: ${totalProcessed}/${totalPendingJobs}`,
        );
      }

      this.logger.log(
        `Completed: ${totalProcessed} succeeded, ${totalFailed} failed`,
      );
    } catch (error) {
      this.logger.error(`Error processing birthday jobs: ${error.message}`);
    }
  }
}
