import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/users.schema';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class BirthdayService {
  private readonly logger = new Logger(BirthdayService.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async checkAndSendBirthdayMessages(): Promise<void> {
    const users = await this.userModel.find();

    for (const user of users) {
      const userLocalTime = toZonedTime(new Date(), user.timezone);

      // if current time is 09:00 AM in user's local timezone
      // log a birthday message if user's next birthday is today
      if (
        userLocalTime.getHours() === 9 &&
        userLocalTime.getMinutes() === 0 &&
        user.birthday.getDate() === userLocalTime.getDate() &&
        user.birthday.getMonth() === userLocalTime.getMonth()
      ) {
        const message = `Happy Birthday, ${user.name}! (${user.email})`;
        this.logger.log(message);
      }
    }
  }
}
