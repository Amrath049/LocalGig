import { Injectable } from '@nestjs/common';
import { JobStatus, Prisma, JobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createJob(data: Prisma.JobCreateInput) {
    return this.prisma.job.create({ data });
  }

  listOpenJobs(filters?: { type?: string; search?: string }) {
    const where: Prisma.JobWhereInput = {
      status: JobStatus.OPEN,
      ...(filters?.type ? { type: filters.type as JobType } : {}),
      ...(filters?.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              {
                description: { contains: filters.search, mode: 'insensitive' },
              },
              { location: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { employer: true },
    });
  }

  findJobById(id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      include: { employer: true },
    });
  }

  listJobsByEmployer(employerId: string) {
    return this.prisma.job.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
      include: {
        applications: {
          include: {
            worker: {
              include: { workerProfile: true },
            },
          },
        },
      },
    });
  }

  closeJob(jobId: string) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.CLOSED, closedAt: new Date() },
    });
  }
}
