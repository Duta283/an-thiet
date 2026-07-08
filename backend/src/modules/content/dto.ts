import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateContentDto {
  @IsUUID()
  restaurantId: string;

  @IsIn(['video', 'image', 'text'])
  mediaType: 'video' | 'image' | 'text';

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  occasions?: string[];
}
