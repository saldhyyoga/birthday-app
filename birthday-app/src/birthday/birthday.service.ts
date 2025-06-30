import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/users.schema';
import { toZonedTime } from 'date-fns-tz';
import { BirthdayJob, BirthdayJobDocument } from './birthdayjob.schema';
import { subDays, addDays, endOfDay, startOfDay } from 'date-fns';
import { calculateNextBirthdayUtc } from '../utils/calculateNextBirthdayUtc';

@Injectable()
export class BirthdayService {
  private readonly logger = new Logger(BirthdayService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(BirthdayJob.name) private jobModel: Model<BirthdayJobDocument>,
  ) {}

  /**
   * Generates birthday jobs for users whose birthday is today.
   *
   * This method performs the following operations:
   * 1. Identifies the current date and extracts month/day components
   * 2. Queries the database for users with birthdays in the current month
   * 3. Filters users whose birthday day matches today (ignoring year)
   * 4. For each matching user, creates a birthday job scheduled to send at 09:00 in their local timezone
   * 5. Skips job creation if a pending job already exists for the user
   *
   * The generated jobs include user details, timezone information, and the UTC timestamp
   * for when the birthday notification should be sent.
   *
   * @returns A Promise that resolves when all birthday jobs have been processed
   * @throws Logs warnings for users with invalid birthday data and errors for failed job creation
   */
  async generateBirthdayJobForToday(): Promise<void> {
    const now = new Date();

    const year = now.getFullYear();
    // Today date parts
    const todayMonth = now.getMonth() + 1; // JS: 0-based → +1 for normal
    const todayDay = now.getDate();
    this.logger.debug(
      `Today is: ${now.toISOString()}, month=${todayMonth}, day=${todayDay}`,
    );

    // Build today's date at UTC midnight to store in job.date
    const todayDate = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );

    // Step 1: Find users whose birthday month matches current month
    const users = await this.userModel.find({
      $expr: { $eq: [{ $month: '$birthday' }, todayMonth] },
    });

    this.logger.debug(
      `Fetched ${users.length} users with birthday in month ${todayMonth}.`,
    );

    // Step 2: Filter users whose birthday day matches today (ignore year)
    const usersWithBirthdayToday = users.filter((user) => {
      try {
        const birthdayDay = user.birthday.getUTCDate();
        const birthdayMonth = user.birthday.getUTCMonth() + 1;

        return birthdayDay === todayDay && birthdayMonth === todayMonth;
      } catch (err) {
        this.logger.warn(`Invalid birthday for user ${user.id}: ${err}`);
        return false;
      }
    });

    this.logger.debug(
      `Found ${usersWithBirthdayToday.length} users with birthday today.`,
    );

    if (usersWithBirthdayToday.length === 0) {
      this.logger.log('🎂 No birthdays today. Done.');
      return;
    }

    // Step 3: For each user, create birthday job if not already exists
    for (const user of usersWithBirthdayToday) {
      try {
        // Build sendBirthdayAt → today at 09:00 user's local time → convert to UTC
        const localDateString = `${year}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}T09:00:00`;
        const sendBirthdayAtUtc = toZonedTime(localDateString, user.timezone);

        // Check if job already exists
        const existingJob = await this.jobModel.findOne({
          userId: user._id,
          sent: false,
        });

        if (existingJob) {
          this.logger.log(
            `Birthday job already exists for user ${user.id} in ${year}-${todayMonth}. Skipping.`,
          );
          continue;
        }

        // Create birthday job
        await this.jobModel.create({
          date: todayDate, // today at UTC midnight
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          birthday: user.birthday,
          timezone: user.timezone,
          sendBirthdayAt: sendBirthdayAtUtc,
          sent: false,
          attempts: 0,
        });

        this.logger.log(
          `Created birthday job for user ${user.id} → sendBirthdayAt (UTC): ${sendBirthdayAtUtc.toString()}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to create birthday job for user ${user.id}: ${err}`,
        );
      }
    }

    this.logger.log(`Finished generating birthday jobs.`);
  }

  /**
   * Checks for birthday jobs that need to be processed and sends birthday logs.
   *
   * This method performs the following operations:
   * 1. Calculates a date range (yesterday, today, tomorrow in UTC) to find relevant birthday jobs
   * 2. Queries for unsent jobs where the birthday matches any date in the range
   * 3. For each job, converts times to the user's local timezone
   * 4. Sends birthday log if current user local time matches the scheduled send time at 9 AM
   * 5. Marks the job as sent and updates the user's next birthday date
   * 6. Retries sending log up to maxRetries if it fails (e.g., on DB/network errors)
   *
   * @returns A promise that resolves when all birthday checks and updates are complete
   *
   * @example
   * ```typescript
   * await birthdayService.checkAndSendBirthdayLogs();
   * ```
   */
  async checkAndSendBirthdayLogs(): Promise<void> {
    const now = new Date();
    const nowUtc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

    // Build date range: yesterday, today, tomorrow (in UTC)
    const yesterday = startOfDay(subDays(nowUtc, 1));
    const tomorrow = endOfDay(addDays(nowUtc, 1));

    const datesToCheck = [
      { month: yesterday.getMonth() + 1, day: yesterday.getDate() },
      { month: now.getMonth() + 1, day: now.getDate() },
      { month: tomorrow.getMonth() + 1, day: tomorrow.getDate() },
    ];

    const jobs = await this.jobModel
      .find({
        sent: false,
        $expr: {
          $or: datesToCheck.map((d) => ({
            $and: [
              { $eq: [{ $month: '$birthday' }, d.month] },
              { $eq: [{ $dayOfMonth: '$birthday' }, d.day] },
            ],
          })),
        },
      })
      .sort({ createdAt: -1 });

    this.logger.debug(`Found ${jobs.length} jobs to check for sending.`);

    for (const job of jobs) {
      const userLocalNow = toZonedTime(nowUtc, job.timezone);
      const sendBirthdayAtLocal = toZonedTime(job.sendBirthdayAt, job.timezone);

      const shouldSend =
        userLocalNow.getMonth() === sendBirthdayAtLocal.getMonth() &&
        userLocalNow.getDate() === sendBirthdayAtLocal.getDate() &&
        userLocalNow.getHours() === sendBirthdayAtLocal.getHours() &&
        !job.sent &&
        userLocalNow.getHours() === 9;

      if (!shouldSend) continue;

      const maxRetries = 3;
      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        try {
          attempt++;
          this.logger.log(
            `Attempt ${attempt}: Sending birthday log to ${job.userName} (${job.userEmail})`,
          );

          // "Send" the message (here: log, but could be real service)
          this.logger.log(
            `Happy Birthday, ${job.userName}! (${job.userEmail})`,
          );

          // Mark as sent & increment attempts
          await this.jobModel.updateOne(
            { _id: job._id },
            {
              sent: true,
              sentAt: new Date(),
              $inc: { attempts: 1 },
            },
          );

          // Update user's nextBirthdayAtUtc
          const nextBirthdayAtUtc = calculateNextBirthdayUtc(
            job.birthday,
            job.timezone,
          );
          await this.userModel.updateOne(
            { _id: job.userId },
            { nextBirthdayAtUtc },
          );

          this.logger.log(
            `Successfully sent and updated user ${job.userId.toString()}; nextBirthdayAtUtc: ${nextBirthdayAtUtc.toISOString()}`,
          );

          success = true; // exit retry loop
        } catch (err) {
          this.logger.error(
            `Failed attempt ${attempt} to send birthday log for ${job.userName}: ${err}`,
          );

          if (attempt < maxRetries) {
            // Exponential backoff: wait 2^attempt seconds
            const delayMs = Math.pow(2, attempt) * 1000;
            this.logger.log(`⏳ Retrying after ${delayMs / 1000} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            this.logger.error(
              `Failed to send birthday log after ${maxRetries} attempts for ${job.userName} (${job.userEmail})`,
            );
          }
        }
      }
    }
  }
}
