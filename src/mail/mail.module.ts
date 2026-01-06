import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  providers: [MailService],
  imports: [HttpModule],
  exports: [MailService],
})
export class MailModule {}
