import { Injectable } from '@nestjs/common';
import { JobStatus, JobType } from '../common/enums';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createJob(data: Prisma.JobCreateInput) {
    return this.prisma.job.create({ data });
  }

  async listOpenJobs(filters?: {
    type?: string;
    search?: string;
    posted?: string;
    skills?: string;
    sort?: string;
    limit?: number;
    page?: number;
  }) {
    const where: Prisma.JobWhereInput = {
      status: JobStatus.OPEN,
    };

    if (filters?.type) {
      where.type = filters.type as JobType;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.posted && filters.posted !== 'Any time') {
      let days = 0;
      if (filters.posted === 'Today') days = 1;
      else if (filters.posted === 'Last 3 days') days = 3;
      else if (filters.posted === 'This week') days = 7;

      if (days > 0) {
        const dateLimit = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        where.createdAt = { gte: dateLimit };
      }
    }

    const orderDirection = filters?.sort === 'oldest' ? 'asc' : 'desc';
    const limit = filters?.limit ?? 10;
    const page = filters?.page ?? 1;
    const skip = (page - 1) * limit;

    const [total, jobs] = await Promise.all([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: orderDirection },
        include: { employer: true },
        take: limit,
        skip,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      jobs,
    };
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
