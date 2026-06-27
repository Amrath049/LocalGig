import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findByIdWithProfiles(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    data: Partial<{
      name: string;
      phone: string;
      businessName: string;
      skillTags: string[];
    }>,
  ) {
    const user = await this.usersRepository.findByIdWithProfiles(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'WORKER') {
      if (!user.workerProfile) {
        throw new NotFoundException('Worker profile not found');
      }
      return this.usersRepository.updateWorkerProfile(userId, {
        name: data.name ?? user.workerProfile.name,
        phone: data.phone ?? user.workerProfile.phone,
        skillTags: data.skillTags ?? user.workerProfile.skillTags,
      });
    }

    if (!user.employerProfile) {
      throw new NotFoundException('Employer profile not found');
    }

    return this.usersRepository.updateEmployerProfile(userId, {
      businessName: data.businessName ?? user.employerProfile.businessName,
      phone: data.phone ?? user.employerProfile.phone,
    });
  }
}
