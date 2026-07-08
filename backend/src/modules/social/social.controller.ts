import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUserId } from '../../common/auth.guard';
import { FollowDto, SaveRestaurantDto } from './dto';
import { SocialService } from './social.service';

@Controller()
export class SocialController {
  constructor(private readonly service: SocialService) {}

  @Get('users/:id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.profile(id);
  }

  @Post('follows')
  @UseGuards(AuthGuard)
  follow(@CurrentUserId() userId: string, @Body() dto: FollowDto) {
    return this.service.follow(userId, dto.followedId);
  }

  @Delete('follows/:followedId')
  @UseGuards(AuthGuard)
  unfollow(
    @CurrentUserId() userId: string,
    @Param('followedId', ParseUUIDPipe) followedId: string,
  ) {
    return this.service.unfollow(userId, followedId);
  }

  @Post('saved')
  @UseGuards(AuthGuard)
  save(@CurrentUserId() userId: string, @Body() dto: SaveRestaurantDto) {
    return this.service.saveRestaurant(userId, dto.restaurantId, dto.listName);
  }

  @Get('saved')
  @UseGuards(AuthGuard)
  listSaved(@CurrentUserId() userId: string) {
    return this.service.listSaved(userId);
  }

  @Delete('saved/:id')
  @UseGuards(AuthGuard)
  removeSaved(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeSaved(userId, id);
  }
}
