import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MessageJobScheduler } from './message-job.scheduler';
import { MessageJobWorker } from './message-job.worker';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, MailModule],
  providers: [MessageJobScheduler, MessageJobWorker],
})
export class MessageJobModule {}
