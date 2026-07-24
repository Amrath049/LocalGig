import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get('suggest')
  async suggest(@Query('q') q: string) {
    return this.skillsService.suggest(q);
  }

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Body('input') input: string,
    @Body('forceCreate') forceCreate?: boolean,
  ) {
    return this.skillsService.resolve(input, !!forceCreate);
  }

  @Post('resolve-batch')
  @HttpCode(HttpStatus.OK)
  async resolveBatch(
    @Body('inputs') inputs: string[],
    @Body('forceCreate') forceCreate?: boolean,
  ) {
    const slugs = await this.skillsService.resolveBatch(inputs, !!forceCreate);
    return { slugs };
  }
}
