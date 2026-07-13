import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, User } from '@prisma/client';
import { JobStatus, JobType } from '../common/enums';
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

  async searchJobs(filters: {
    type?: string;
    search?: string;
    posted?: string;
    skills?: string;
    sort?: string;
    limit?: number;
    page?: number;
    workerSkills?: string;
  }) {
    const filter: Array<Record<string, unknown>> = [
      { term: { status: JobStatus.OPEN } },
    ];

    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }

    if (filters.posted && filters.posted !== 'Any time') {
      let gteValue = '';
      if (filters.posted === 'Today') gteValue = 'now-1d/d';
      else if (filters.posted === 'Last 3 days') gteValue = 'now-3d/d';
      else if (filters.posted === 'This week') gteValue = 'now-7d/d';

      if (gteValue) {
        filter.push({
          range: {
            createdAt: { gte: gteValue },
          },
        });
      }
    }

    if (filters.skills) {
      const skillsList = filters.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (skillsList.length > 0) {
        filter.push({
          terms: {
            skills: skillsList.map((s) => s.toLowerCase()),
          },
        });
      }
    }

    const must: Array<Record<string, unknown>> = [];
    const should: Array<Record<string, unknown>> = [];

    if (filters.search) {
      must.push({
        bool: {
          should: [
            {
              multi_match: {
                query: filters.search,
                fields: ['title^5', 'description', 'location', 'skills'],
                fuzziness: 'AUTO',
                prefix_length: 1,
                max_expansions: 50,
              },
            },
            {
              match: {
                title: {
                  query: filters.search,
                  fuzziness: 'AUTO',
                  boost: 5,
                },
              },
            },
            {
              match: {
                description: {
                  query: filters.search,
                  fuzziness: 'AUTO',
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    // Boost matching candidate skills
    if (filters.workerSkills) {
      const workerSkillsList = filters.workerSkills
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (workerSkillsList.length > 0) {
        should.push({
          terms: {
            skills: workerSkillsList,
            boost: 2.5,
          },
        });
      }
    }

    const sortOrder = filters.sort === 'oldest' ? 'asc' : 'desc';
    const limit = filters.limit ?? 10;
    const page = filters.page ?? 1;
    const from = (page - 1) * limit;

    const body: Record<string, unknown> = {
      size: limit,
      from,
      sort:
        filters.sort === 'oldest'
          ? [{ createdAt: { order: 'asc' } }]
          : filters.search || filters.workerSkills
          ? [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }]
          : [{ createdAt: { order: 'desc' } }],
      query: {
        bool: {
          filter,
          must,
          ...(should.length ? { should } : {}),
        },
      },
      aggs: {
        all_skills: {
          terms: { field: 'skills', size: 30 },
        },
        all_types: {
          terms: { field: 'type', size: 10 },
        },
        all_locations: {
          terms: { field: 'location.keyword', size: 30 },
        },
      },
    };

    if (filters.search) {
      body.highlight = {
        fields: {
          title: {},
          description: { fragment_size: 150, number_of_fragments: 1 },
        },
        pre_tags: [
          '<mark class="bg-orange-100 text-[#7C4A2D] font-medium px-1 rounded">',
        ],
        post_tags: ['</mark>'],
      };
    }

    const response = await this.request<any>(`/${this.indexName}/_search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const total =
      typeof response.hits.total === 'object'
        ? response.hits.total.value
        : response.hits.total || 0;

    const jobs = response.hits.hits.map((hit: any) => {
      const job = hit._source;
      if (hit.highlight) {
        if (hit.highlight.title) {
          job.highlightedTitle = hit.highlight.title[0];
        }
        if (hit.highlight.description) {
          job.highlightedDescription = hit.highlight.description[0];
        }
      }
      return job;
    });

    const facets = {
      skills: response.aggregations?.all_skills?.buckets ?? [],
      types: response.aggregations?.all_types?.buckets ?? [],
      locations: response.aggregations?.all_locations?.buckets ?? [],
    };

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      jobs,
      facets,
    };
  }

  async getSimilarJobs(jobId: string, limit = 3) {
    const body = {
      size: limit,
      query: {
        bool: {
          filter: [{ term: { status: JobStatus.OPEN } }],
          must_not: [{ term: { id: jobId } }],
          must: [
            {
              more_like_this: {
                fields: ['title', 'description', 'skills'],
                like: [{ _index: this.indexName, _id: jobId }],
                min_term_freq: 1,
                max_query_terms: 12,
                min_doc_freq: 1,
              },
            },
          ],
        },
      },
    };

    try {
      const response = await this.request<{
        hits: {
          hits: Array<{ _source: IndexedJob }>;
        };
      }>(`/${this.indexName}/_search`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return response.hits.hits.map((hit) => hit._source);
    } catch (error) {
      console.log({ error });
      this.logger.error(
        `Failed to fetch similar jobs for ${jobId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async suggestJobs(query: string, limit = 5) {
    if (!query) return [];

    const body = {
      size: limit * 2,
      query: {
        bool: {
          filter: [{ term: { status: JobStatus.OPEN } }],
          should: [
            {
              match_phrase_prefix: {
                title: {
                  query,
                  boost: 3,
                },
              },
            },
            {
              prefix: {
                skills: {
                  value: query,
                  case_insensitive: true,
                  boost: 2,
                },
              },
            },
            {
              prefix: {
                title: {
                  value: query.toLowerCase(),
                  boost: 1.5,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
    };

    try {
      const response = await this.request<{
        hits: {
          hits: Array<{ _source: IndexedJob }>;
        };
      }>(`/${this.indexName}/_search`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const suggestions = new Set<string>();
      for (const hit of response.hits.hits) {
        const job = hit._source;
        if (job.title.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(job.title);
        }
        for (const skill of job.skills ?? []) {
          if (skill.toLowerCase().includes(query.toLowerCase())) {
            suggestions.add(skill);
          }
        }
      }
      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Failed to get suggestions for query "${query}": ${(error as Error).message}`,
      );
      return [];
    }
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
        if (!job || job.status !== JobStatus.OPEN) {
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
    let needsRecreate = false;
    if (exists.ok) {
      try {
        const mapping = await this.request<any>(`/${this.indexName}/_mapping`);
        const locationMapping =
          mapping[this.indexName]?.mappings?.properties?.location;
        if (!locationMapping?.fields?.keyword) {
          this.logger.log(
            `Outdated index mapping detected for ${this.indexName}, deleting...`,
          );
          await this.requestRaw(`/${this.indexName}`, { method: 'DELETE' });
          needsRecreate = true;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to inspect mapping: ${(error as Error).message}`,
        );
      }
    } else {
      needsRecreate = true;
    }

    if (!needsRecreate) {
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
          location: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword', ignore_above: 256 },
            },
          },
          payType: { type: 'keyword' },
          payAmount: { type: 'integer' },
          payMin: { type: 'integer' },
          payMax: { type: 'integer' },
          payCustom: { type: 'text' },
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
    this.logger.log(
      `Search index ${this.indexName} created with updated mappings`,
    );
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
      skills: job.skills ?? [],
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
