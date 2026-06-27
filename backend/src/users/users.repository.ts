import { Injectable } from '@nestjs/common';
import { User, RefreshToken } from '@prisma/client';
import { PrismaService as DbService } from '../prisma/prisma.service';

/**
 * All DB access for users + their role-specific profiles.
 * Only this layer touches Prisma (per the project's layering rule).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: DbService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmailWithProfiles(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { workerProfile: true, employerProfile: true },
    });
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
    role: string;
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

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.refreshToken.create({ data });
  }

  deleteEmailVerificationOtps(userId: string) {
    return this.prisma.emailVerificationOtp.deleteMany({
      where: { userId, consumedAt: null },
    });
  }

  createEmailVerificationOtp(data: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.emailVerificationOtp.create({ data });
  }

  findEmailVerificationOtp(userId: string, codeHash: string) {
    return this.prisma.emailVerificationOtp.findFirst({
      where: { userId, codeHash, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  consumeEmailVerificationOtp(id: string) {
    return this.prisma.emailVerificationOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  deleteRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  updateWorkerProfile(
    userId: string,
    data: { name: string; phone: string; skillTags: string[] },
  ) {
    return this.prisma.workerProfile.update({
      where: { userId },
      data,
    });
  }

  updateEmployerProfile(
    userId: string,
    data: { businessName: string; phone: string },
  ) {
    return this.prisma.employerProfile.update({
      where: { userId },
      data,
    });
  }
}
