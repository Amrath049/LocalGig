import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { ApplicationStatus } from '@prisma/client';

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles('WORKER')
  apply(@CurrentUser() user: any, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.apply(user.id, dto);
  }

  @Get('me')
  @Roles('WORKER')
  myApplications(@CurrentUser() user: any) {
    return this.applicationsService.listMyApplications(user.id);
  }

  @Get('employer')
  @Roles('EMPLOYER')
  employerApplications(@CurrentUser() user: any) {
    return this.applicationsService.listApplicationsForEmployer(user.id);
  }

  @Patch(':id/status')
  @Roles('EMPLOYER')
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('status') status: ApplicationStatus,
  ) {
    return this.applicationsService.updateStatus(user.id, id, status);
  }
}
