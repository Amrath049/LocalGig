import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, JobType, User } from '@prisma/client';
import Redis from 'ioredis';
import { SearchRepository } from './search.repository';

type IndexedJob = Job & { employer: User };
type QueueAction = 'index' | 'remove';
type QueueMessage = { action: QueueAction; jobId: string };

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = 'localgig_jobs';
  private readonly queueName = 'localgig:jobs:index-queue';
  private readonly searchNode: URL;
  private readonly redis: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly searchRepository: SearchRepository,
  ) {
    const node = this.cleanConfigValue(
      this.config.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
    );
    this.searchNode = new URL(node);

    const redisUrl = this.cleanConfigValue(
      this.config.get<string>('REDIS_URL'),
    );
    this.redis = redisUrl
      ? new Redis(redisUrl, { maxRetriesPerRequest: 2 })
      : new Redis({
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: 2,
        });
  }

  async onModuleInit() {
    try {
      await this.ensureIndex();
      await this.syncOpenJobs();
      await this.processQueue();
    } catch (error) {
      this.logger.warn(
        `Search startup sync skipped: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async enqueueJobIndex(jobId: string, action: QueueAction = 'index') {
    await this.redis.rpush(
      this.queueName,
      JSON.stringify({ action, jobId } satisfies QueueMessage),
    );
    await this.processQueue();
  }

  async syncOpenJobs() {
    const jobs = await this.searchRepository.listOpenJobsForIndex();
    await Promise.all(jobs.map((job) => this.indexJob(job)));
    return { indexed: jobs.length };
  }

  async searchJobs(filters: { type?: string; search?: string }) {
    const filter: Array<Record<string, unknown>> = [
      { term: { status: 'OPEN' } },
    ];

    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }

    // Build a robust search that supports fuzzy matches, prefix matches and
    // falls back to simpler queries. This helps with typos like "dryver" → "driver"
    // and improves matching for short/partial terms.
    const should: Array<Record<string, unknown>> = [];
    if (filters.search) {
      // Fuzzy multi-field match (boost title)
      should.push({
        multi_match: {
          query: filters.search,
          fields: ['title^5', 'description', 'location', 'skills'],
          fuzziness: 2,
          prefix_length: 1,
          max_expansions: 50,
        },
      });

      // Prefix search on title/description for partial matches
      // should.push({
      //   multi_match: {
      //     query: filters.search,
      //     fields: ['title^3', 'description'],
      //     type: 'phrase_prefix',
      //   },
      // });

      // Individual fuzzy field matches to increase recall for typos
      should.push({
        match: {
          title: {
            query: filters.search,
            fuzziness: 2,
            boost: 5,
          },
        },
      });
      should.push({
        match: {
          description: {
            query: filters.search,
            fuzziness: 2,
          },
        },
      });
    }

    const body: Record<string, unknown> = {
      size: 50,
      sort: [{ createdAt: { order: 'desc' } }],
      query: {
        bool: {
          filter,
          ...(should.length
            ? { should, minimum_should_match: 1 }
            : { must: [{ match_all: {} }] }),
        },
      },
    };

    console.log(JSON.stringify(body, null, 2));

    const response = await this.request<{
      hits: { hits: Array<{ _source: IndexedJob }> };
    }>(`/${this.indexName}/_search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    console.log(JSON.stringify(response, null, 2));

    return response.hits.hits.map((hit) => hit._source);
  }

  private async processQueue() {
    while (true) {
      const raw = await this.redis.lpop(this.queueName);
      if (!raw) return;

      try {
        const message = JSON.parse(raw) as QueueMessage;
        if (message.action === 'remove') {
          await this.removeJob(message.jobId);
          continue;
        }

        const job = await this.searchRepository.findJobForIndex(message.jobId);
        if (!job || job.status !== 'OPEN') {
          await this.removeJob(message.jobId);
          continue;
        }

        await this.indexJob(job);
      } catch (error) {
        this.logger.error(
          'Failed to process job search queue item',
          error as Error,
        );
      }
    }
  }

  private async ensureIndex() {
    const exists = await this.requestRaw(`/${this.indexName}`, {
      method: 'HEAD',
    });
    if (exists.ok) {
      // Attempt to add the `skills` property to an existing index mapping if it's
      // not already present. Adding new fields to mappings is allowed; ignore
      // failures and continue.
      try {
        await this.request(`/${this.indexName}/_mapping`, {
          method: 'PUT',
          body: JSON.stringify({ properties: { skills: { type: 'keyword' } } }),
        });
      } catch (error) {
        this.logger.warn(
          `Failed to update mapping for ${this.indexName}: ${(error as Error).message}`,
        );
      }
      return;
    }

    const body = {
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: { type: 'text' },
          description: { type: 'text' },
          type: { type: 'keyword' },
          status: { type: 'keyword' },
          location: { type: 'text' },
          payType: { type: 'keyword' },
          payAmount: { type: 'integer' },
          payMin: { type: 'integer' },
          payMax: { type: 'integer' },
          payCustom: { type: 'text' },
          // Optional skills/tags field (not yet present on the Job model)
          skills: { type: 'keyword' },
          createdAt: { type: 'date' },
          employer: {
            properties: {
              id: { type: 'keyword' },
              email: { type: 'keyword' },
            },
          },
        },
      },
    };

    await this.request(`/${this.indexName}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    this.logger.log(`Search index ${this.indexName} is ready`);
  }

  private async indexJob(job: IndexedJob) {
    await this.request(`/${this.indexName}/_doc/${job.id}`, {
      method: 'PUT',
      body: JSON.stringify(this.toDocument(job)),
    });
  }

  private async removeJob(jobId: string) {
    const response = await this.requestRaw(`/${this.indexName}/_doc/${jobId}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Search delete failed with status ${response.status}`);
    }
  }

  private toDocument(job: IndexedJob) {
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      type: job.type as JobType,
      location: job.location,
      status: job.status,
      payType: job.payType,
      payAmount: job.payAmount,
      payMin: job.payMin,
      payMax: job.payMax,
      payCustom: job.payCustom,
      employer: {
        id: job.employer.id,
        email: job.employer.email,
      },
      // If/when jobs include explicit skill tags, populate this array. For now
      // include an empty array to keep the field present.
      skills: (job as any).skills ?? [],
      createdAt: job.createdAt.toISOString(),
    };
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const response = await this.requestRaw(path, init);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Search request failed ${response.status}: ${text}`);
    }
    return (await response.json()) as T;
  }

  private requestRaw(path: string, init: RequestInit = {}) {
    const baseUrl = `${this.searchNode.protocol}//${this.searchNode.host}`;
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');

    if (this.searchNode.username || this.searchNode.password) {
      const credentials = `${decodeURIComponent(this.searchNode.username)}:${decodeURIComponent(this.searchNode.password)}`;
      headers.set(
        'Authorization',
        `Basic ${Buffer.from(credentials).toString('base64')}`,
      );
    }

    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
  }

  private cleanConfigValue(value?: string) {
    return (value ?? '').trim().replace(/^['"]|['"]$/g, '');
  }
}
