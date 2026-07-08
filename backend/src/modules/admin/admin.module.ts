import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Content } from '../../entities/content.entity';
import { User } from '../../entities/user.entity';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { SearchModule } from '../search/search.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Content, User]),
    RestaurantsModule,
    SearchModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
