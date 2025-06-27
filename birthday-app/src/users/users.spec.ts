import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './users.schema';
import { NotFoundException } from '@nestjs/common';
import { CreateOrUpdateUserDto } from './users.dto';

const mockUser = {
  _id: 'user123',
  name: 'Bill Gates',
  email: 'bill.gates@microsoft.com',
  birthday: new Date('1990-12-25T00:00:00.000Z'),
  timezone: 'Asia/Jakarta',
};

describe('UsersService', () => {
  let service: UsersService;
  let model: any;

  beforeEach(async () => {
    const mockModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    model = module.get(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    it('should create and return a user', async () => {
      const createUserDto: CreateOrUpdateUserDto = {
        name: 'Bill Gates',
        email: 'bill.gates@microsoft.com',
        birthday: '1990-12-25T00:00:00.000Z',
        timezone: 'Asia/Jakarta',
      };

      const mockCreatedUser = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(mockUser),
      };

      // Correct way to spy on create
      jest.spyOn(model, 'create').mockResolvedValueOnce(mockCreatedUser);

      const result = await service.create(createUserDto);

      expect(model.create).toHaveBeenCalledWith(createUserDto);
      expect(mockCreatedUser.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById()', () => {
    it('should return a user by ID', async () => {
      jest.spyOn(model, 'findById').mockResolvedValueOnce(mockUser);
      const result = await service.findById('user123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(model, 'findById').mockResolvedValueOnce(null);
      await expect(service.findById('notfound')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update()', () => {
    it('should update and return user', async () => {
      const updateDto: Partial<CreateOrUpdateUserDto> = {
        name: 'Updated Name',
      };

      const updatedUser = { ...mockUser, ...updateDto };

      jest.spyOn(model, 'findById').mockResolvedValueOnce(mockUser);
      jest.spyOn(model, 'findByIdAndUpdate').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await service.update('user123', updateDto);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest.spyOn(model, 'findById').mockResolvedValueOnce(null);
      await expect(service.update('notfound', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('should delete the user', async () => {
      jest.spyOn(model, 'findByIdAndDelete').mockResolvedValueOnce(mockUser);
      await expect(service.remove('user123')).resolves.toBeUndefined();
    });

    it('should throw NotFoundException if user is not found', async () => {
      jest.spyOn(model, 'findByIdAndDelete').mockResolvedValueOnce(null);
      await expect(service.remove('notfound')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
