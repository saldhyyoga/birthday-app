// src/birthday/birthday.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/users.schema';
import { BirthdayService } from './birthday.service';
import { BirthdayWorker } from './birthday.worker';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [BirthdayService, BirthdayWorker],
})
export class BirthdayModule {}
