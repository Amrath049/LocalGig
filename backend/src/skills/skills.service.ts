import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(q: string) {
    if (!q || q.trim().length < 2) {
      return { skills: [] };
    }

    const query = q.trim();
    const queryLower = query.toLowerCase();

    const matches = await this.prisma.skill.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { aliases: { has: queryLower } },
        ],
      },
      take: 8,
      orderBy: {
        name: 'asc',
      },
    });

    return {
      skills: matches.map((s) => ({
        slug: s.slug,
        name: s.name,
      })),
    };
  }

  normalizeInput(input: string): { name: string; slug: string; alias: string } {
    const trimmed = input.trim();
    const lowercase = trimmed.toLowerCase();
    const slug = lowercase
      .replace(/[\s\.]+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return {
      name: trimmed,
      slug: slug || 'skill-' + Math.random().toString(36).substr(2, 5),
      alias: lowercase,
    };
  }

  async resolve(input: string, forceCreate = false) {
    if (!input || !input.trim()) {
      throw new NotFoundException('Skill input is empty');
    }

    const normalized = this.normalizeInput(input);

    // Look up by slug or alias
    let skill = await this.prisma.skill.findFirst({
      where: {
        OR: [
          { slug: normalized.slug },
          { aliases: { has: normalized.alias } },
        ],
      },
    });

    if (!skill && forceCreate) {
      try {
        skill = await this.prisma.skill.create({
          data: {
            name: normalized.name,
            slug: normalized.slug,
            aliases: [normalized.alias],
          },
        });
      } catch (err) {
        // Fallback for race conditions
        skill = await this.prisma.skill.findFirst({
          where: {
            OR: [
              { slug: normalized.slug },
              { aliases: { has: normalized.alias } },
            ],
          },
        });
        if (!skill) throw err;
      }
    }

    if (!skill) {
      throw new NotFoundException(`Skill "${input}" could not be resolved`);
    }

    return skill;
  }

  async resolveBatch(inputs: string[], forceCreate = false): Promise<string[]> {
    if (!inputs || !Array.isArray(inputs)) {
      return [];
    }

    const slugs: string[] = [];
    for (const input of inputs) {
      if (!input || !input.trim()) continue;
      try {
        const resolved = await this.resolve(input, forceCreate);
        slugs.push(resolved.slug);
      } catch (err) {
        if (err instanceof NotFoundException) {
          // If forceCreate is false, skip or let it throw. But typically for batch we skip/resolve what we can or let it fail.
          // Let's let it throw if forceCreate is false to be safe, or skip unresolved ones.
          // The prompt says: "resolves/creates all in one call, returns array of slugs"
          if (!forceCreate) throw err;
        } else {
          throw err;
        }
      }
    }
    return Array.from(new Set(slugs));
  }
}
