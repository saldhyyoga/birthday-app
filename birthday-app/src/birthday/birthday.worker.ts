// src/birthday/birthday.worker.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BirthdayService } from './birthday.service';

@Injectable()
export class BirthdayWorker {
  constructor(private readonly birthdayService: BirthdayService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    console.log('Running birthday check worker...');
    await this.birthdayService.checkAndSendBirthdayMessages();
  }
}
