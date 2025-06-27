import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { BirthdayModule } from './birthday/birthday.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    MongooseModule.forRoot(
      'mongodb://root:password@mongodb:27017/birthdayapp?authSource=admin',
    ),
    UsersModule,
    ScheduleModule.forRoot(),
    BirthdayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
