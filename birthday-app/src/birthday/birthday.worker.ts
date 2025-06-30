// src/birthday/birthday.worker.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BirthdayService } from './birthday.service';

@Injectable()
export class BirthdayWorker {
  private readonly logger = new Logger(BirthdayWorker.name);
  constructor(private readonly birthdayService: BirthdayService) {}

  // run every 15 minutes
  @Cron('0 */15 * * * *')
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    this.logger.log('Running birthday check worker...');

    const now = new Date();
    const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

    this.logger.log(
      `Current Time Hour:Minutes:Second ${utcDate.getHours()}:${utcDate.getMinutes()}:${utcDate.getSeconds()}`,
    );

    const hours = utcDate.getHours();
    const minutes = utcDate.getMinutes();

    if (hours === 0 && minutes === 0) {
      this.logger.log(
        '🎉 It is 00:00 UTC time! Running generate birthday job...',
      );

      await this.birthdayService.generateBirthdayJobForToday();
    } else {
      this.logger.debug(`Current UTC time: ${utcDate.toISOString()}`);
      await this.birthdayService.checkAndSendBirthdayLogs();
    }
  }
}
