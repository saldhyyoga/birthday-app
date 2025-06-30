import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './users.schema';
import { CreateOrUpdateUserDto } from './users.dto';
import { calculateNextBirthdayUtc } from '../utils/calculateNextBirthdayUtc';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateOrUpdateUserDto): Promise<User> {
    // Convert birthday string to Date
    const birthday = new Date(createUserDto.birthday);

    // Calculate nextBirthdayAtUtc
    const nextBirthdayAtUtc = calculateNextBirthdayUtc(
      birthday,
      createUserDto.timezone,
    );

    // Create and save user with nextBirthdayAtUtc
    const user = await this.userModel.create({
      ...createUserDto,
      birthday,
      nextBirthdayAtUtc,
    });

    return user.save();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(
    id: string,
    updateDto: Partial<CreateOrUpdateUserDto>,
  ): Promise<User> {
    const existingUser = await this.userModel.findById(id);
    if (!existingUser) throw new NotFoundException('User not found');

    // Convert birthday to Date if provided, else keep existing
    const effectiveBirthday = updateDto.birthday
      ? new Date(updateDto.birthday)
      : existingUser.birthday;

    const effectiveTimezone = updateDto.timezone ?? existingUser.timezone;

    // Recalculate nextBirthdayAtUtc if birthday or timezone changed
    let nextBirthdayAtUtc = existingUser.nextBirthdayAtUtc;
    if (updateDto.birthday || updateDto.timezone) {
      nextBirthdayAtUtc = calculateNextBirthdayUtc(
        effectiveBirthday,
        effectiveTimezone,
      );
    }

    const updatedFields: Partial<User> = {
      ...updateDto,
      birthday: updateDto.birthday ? new Date(updateDto.birthday) : undefined,
      nextBirthdayAtUtc,
    };

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updatedFields, { new: true })
      .exec();

    if (!updatedUser)
      throw new NotFoundException(`User with id ${id} not found`);

    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('User not found');
  }
}
