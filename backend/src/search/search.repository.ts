import { Injectable } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findJobForIndex(id: string) {
    return this.prisma.job.findUnique({
      where: { id },
      include: { employer: true },
    });
  }

  listOpenJobsForIndex() {
    return this.prisma.job.findMany({
      where: { status: JobStatus.OPEN },
      include: { employer: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
