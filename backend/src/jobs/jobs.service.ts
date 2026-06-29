import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JobType, PayType } from '../common/enums';
import { JobsRepository } from './jobs.repository';
import { CreateJobDto } from './dto/create-job.dto';
import { SearchService } from '../search/search.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly searchService: SearchService,
  ) {}

  async createJob(userId: string, body: CreateJobDto) {
    if (!body.title || !body.description || !body.type) {
      throw new BadRequestException('Missing required job fields');
    }

    const job = await this.jobsRepository.createJob({
      title: body.title,
      description: body.description,
      type: body.type as JobType,
      location: body.location ?? null,
      payType: body.payType as PayType,
      payAmount: body.payAmount ?? null,
      payMin: body.payMin ?? null,
      payMax: body.payMax ?? null,
      payCustom: body.payCustom ?? null,
      employer: { connect: { id: userId } },
    });

    await this.enqueueSearchUpdate(job.id);
    return job;
  }

  async createBulkJobs(userId: string, dtos: CreateJobDto[]) {
    if (!Array.isArray(dtos)) {
      throw new BadRequestException('Payload must be an array of jobs');
    }

    const createdJobs = [];
    for (const dto of dtos) {
      if (!dto.title || !dto.description || !dto.type) {
        throw new BadRequestException(
          'Missing required fields on one or more jobs',
        );
      }

      const job = await this.jobsRepository.createJob({
        title: dto.title,
        description: dto.description,
        type: dto.type as JobType,
        location: dto.location ?? null,
        payType: dto.payType as PayType,
        payAmount: dto.payAmount ?? null,
        payMin: dto.payMin ?? null,
        payMax: dto.payMax ?? null,
        payCustom: dto.payCustom ?? null,
        employer: { connect: { id: userId } },
      });

      await this.enqueueSearchUpdate(job.id);
      createdJobs.push(job);
    }

    return { count: createdJobs.length, jobs: createdJobs };
  }

  async listJobs(filters: {
    type?: string;
    search?: string;
    posted?: string;
    skills?: string;
    sort?: string;
    limit?: number;
    page?: number;
  }) {
    if (
      filters.search ||
      filters.type ||
      filters.posted ||
      filters.skills ||
      filters.sort ||
      filters.limit ||
      filters.page
    ) {
      try {
        return await this.searchService.searchJobs(filters);
      } catch (error) {
        this.logger.warn(
          `Search unavailable, falling back to database: ${(error as Error).message}`,
        );
      }
    }

    return this.jobsRepository.listOpenJobs(filters);
  }

  async listMyJobs(userId: string) {
    return this.jobsRepository.listJobsByEmployer(userId);
  }

  async closeJob(jobId: string, userId: string) {
    const job = await this.jobsRepository.findJobById(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.employerId !== userId) {
      throw new ForbiddenException('You are not allowed to close this job');
    }
    const closedJob = await this.jobsRepository.closeJob(jobId);
    await this.enqueueSearchUpdate(jobId, 'remove');
    return closedJob;
  }

  private async enqueueSearchUpdate(
    jobId: string,
    action: 'index' | 'remove' = 'index',
  ) {
    try {
      await this.searchService.enqueueJobIndex(jobId, action);
    } catch (error) {
      this.logger.warn(
        `Unable to enqueue job search update for ${jobId}: ${(error as Error).message}`,
      );
    }
  }
}
