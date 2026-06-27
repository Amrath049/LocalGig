import { Module } from '@nestjs/common';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [PrismaModule, SearchModule],
  providers: [JobsRepository, JobsService, RolesGuard],
  exports: [JobsRepository, JobsService],
  controllers: [JobsController],
})
export class JobsModule {}
