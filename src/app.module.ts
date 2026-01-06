import { HttpStatus, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { providePrismaClientExceptionFilter } from './filters/prisma-exception-filter';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageJobModule } from './message-job/message-job.module';

@Module({
  imports: [ScheduleModule.forRoot(), UserModule, MessageJobModule],
  controllers: [AppController],
  providers: [
    AppService,
    providePrismaClientExceptionFilter({
      P2000: HttpStatus.BAD_REQUEST,
      P2002: HttpStatus.CONFLICT,
      // to indicate temporary issues with the server's ability to handle requests.
      // https://www.prisma.io/docs/orm/reference/error-reference#p2024
      P2024: HttpStatus.SERVICE_UNAVAILABLE,
      P2025: HttpStatus.NOT_FOUND,
    }),
  ],
})
export class AppModule {}
