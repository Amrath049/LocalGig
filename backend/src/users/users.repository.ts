import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * All DB access for users + their role-specific profiles.
 * Only this layer touches Prisma (per the project's layering rule).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdWithProfiles(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { workerProfile: true, employerProfile: true },
    });
  }

  /** Create a user together with its role-specific profile in one transaction. */
  createWithProfile(params: {
    email: string;
    passwordHash: string;
    role: Role;
    worker?: { name: string; phone: string; skillTags: string[] };
    employer?: { businessName: string; phone: string };
  }): Promise<User> {
    const { email, passwordHash, role, worker, employer } = params;
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        workerProfile: worker ? { create: worker } : undefined,
        employerProfile: employer ? { create: employer } : undefined,
      },
    });
  }

  markEmailVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isEmailVerified: true },
    });
  }
}
