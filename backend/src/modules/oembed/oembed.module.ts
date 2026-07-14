import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Content } from '../../entities/content.entity';
import { OembedController } from './oembed.controller';
import { OembedService } from './oembed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Content])],
  controllers: [OembedController],
  providers: [OembedService],
  exports: [OembedService],
})
export class OembedModule {}
