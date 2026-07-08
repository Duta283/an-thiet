import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from '../../entities/follow.entity';
import { SavedItem } from '../../entities/saved-item.entity';
import { User } from '../../entities/user.entity';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, SavedItem, User])],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
