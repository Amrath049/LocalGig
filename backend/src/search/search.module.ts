import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';

@Module({
  imports: [PrismaModule],
  providers: [SearchRepository, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
