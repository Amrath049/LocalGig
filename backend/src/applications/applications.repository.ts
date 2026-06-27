import { Injectable } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createApplication(data: {
    jobId: string;
    workerId: string;
    message?: string;
  }) {
    return this.prisma.application.create({ data });
  }

  findByWorkerAndJob(workerId: string, jobId: string) {
    return this.prisma.application.findUnique({
      where: { jobId_workerId: { workerId, jobId } },
    });
  }

  listByWorker(workerId: string) {
    return this.prisma.application.findMany({
      where: { workerId },
      include: { job: { include: { employer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listByEmployer(employerId: string) {
    return this.prisma.application.findMany({
      where: { job: { employerId } },
      include: { job: true, worker: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateStatus(id: string, status: ApplicationStatus) {
    return this.prisma.application.update({ where: { id }, data: { status } });
  }
}
