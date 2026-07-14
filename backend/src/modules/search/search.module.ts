import { Module } from '@nestjs/common';
import { OembedModule } from '../oembed/oembed.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [OembedModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
