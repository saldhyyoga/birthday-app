import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateOrUpdateUserDto, UserDto } from './user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(@Body() dto: CreateOrUpdateUserDto): Promise<UserDto> {
    return this.userService.createUser(dto);
  }

  @HttpCode(204)
  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<void> {
    return this.userService.deleteUser(id);
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: CreateOrUpdateUserDto,
  ): Promise<UserDto> {
    console.log('id', id);
    return this.userService.updateUser(id, dto);
  }
}
