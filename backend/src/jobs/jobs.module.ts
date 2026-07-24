import { Module } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { SearchModule } from '../search/search.module';
import { SkillsModule } from '../skills/skills.module';

@Module({
  imports: [PrismaModule, SearchModule, SkillsModule],
  providers: [JobsRepository, JobsService, RolesGuard],
  exports: [JobsRepository, JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
