import { IsOptional, IsString, IsUUID } from 'class-validator';

export class FollowDto {
  @IsUUID()
  followedId: string;
}

export class SaveRestaurantDto {
  @IsUUID()
  restaurantId: string;

  @IsOptional()
  @IsString()
  listName?: string;
}
