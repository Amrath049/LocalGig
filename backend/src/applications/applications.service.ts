import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { ApplicationsRepository } from './applications.repository';
import { JobsRepository } from '../jobs/jobs.repository';
import { CreateApplicationDto } from './dto/create-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly jobsRepository: JobsRepository,
  ) {}

  async apply(workerId: string, dto: CreateApplicationDto) {
    const job = await this.jobsRepository.findJobById(dto.jobId);
    if (!job || job.status !== 'OPEN') {
      throw new BadRequestException('Job is not available');
    }

    const existing = await this.applicationsRepository.findByWorkerAndJob(
      workerId,
      dto.jobId,
    );
    if (existing) {
      throw new BadRequestException('You have already applied to this job');
    }

    return this.applicationsRepository.createApplication({
      jobId: dto.jobId,
      workerId,
      message: dto.message,
    });
  }

  async listMyApplications(workerId: string) {
    return this.applicationsRepository.listByWorker(workerId);
  }

  async listApplicationsForEmployer(employerId: string) {
    return this.applicationsRepository.listByEmployer(employerId);
  }

  async updateStatus(
    employerId: string,
    applicationId: string,
    status: ApplicationStatus,
  ) {
    const applications =
      await this.applicationsRepository.listByEmployer(employerId);
    const application = applications.find((app) => app.id === applicationId);
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return this.applicationsRepository.updateStatus(applicationId, status);
  }
}
