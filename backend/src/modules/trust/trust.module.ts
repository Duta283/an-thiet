import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
