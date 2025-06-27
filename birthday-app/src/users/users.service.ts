import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './users.schema';
import { CreateOrUpdateUserDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateOrUpdateUserDto): Promise<User> {
    const user = await this.userModel.create({
      ...createUserDto,
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

    const updatedFields: Partial<User> = {
      ...updateDto,
      birthday: updateDto.birthday ? new Date(updateDto.birthday) : undefined,
    };

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updatedFields, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('User not found');
  }
}
