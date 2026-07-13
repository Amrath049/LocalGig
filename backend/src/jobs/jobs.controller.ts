import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller('jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('posted') posted?: string,
    @Query('skills') skills?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('workerSkills') workerSkills?: string,
  ) {
    this.logger.log(`List job api called:${search}`);
    return this.jobsService.listJobs({
      type,
      search,
      posted,
      skills,
      sort,
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      workerSkills,
    });
  }

  @Get('suggest')
  suggest(@Query('query') query: string) {
    this.logger.log(`Suggest jobs called with query: ${query}`);
    return this.jobsService.getJobSuggestions(query || '');
  }

  @Get(':id/similar')
  similar(@Param('id') id: string) {
    this.logger.log(`Get similar jobs called for: ${id}`);
    return this.jobsService.getSimilarJobs(id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  myJobs(@CurrentUser() user: any) {
    this.logger.log('Get my jobs called');
    return this.jobsService.listMyJobs(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  create(@CurrentUser() user: any, @Body() dto: CreateJobDto) {
    this.logger.log('Create job called');
    return this.jobsService.createJob(user.id, dto);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  createBulk(@CurrentUser() user: any, @Body() dtos: CreateJobDto[]) {
    this.logger.log('Create bulk job called');
    return this.jobsService.createBulkJobs(user.id, dtos);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  close(@CurrentUser() user: any, @Param('id') id: string) {
    this.logger.log('Close job called');
    return this.jobsService.closeJob(id, user.id);
  }

  @Patch(':id/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    this.logger.log('Remove job called');
    return this.jobsService.removeJob(id, user.id);
  }
}
