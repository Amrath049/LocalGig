import { Module } from '@nestjs/common';
import { ApplicationsRepository } from './applications.repository';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsModule } from '../jobs/jobs.module';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [PrismaModule, JobsModule],
  providers: [ApplicationsRepository, ApplicationsService, RolesGuard],
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
