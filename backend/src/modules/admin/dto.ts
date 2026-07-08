import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { CreateRestaurantDto } from '../restaurants/dto';

export class SeedUserDto {
  @IsString()
  displayName: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

/**
 * Nội dung tổng hợp từ TikTok/Threads — nạp qua seed tool.
 * Bắt buộc đủ nguồn gốc + credit (không có thì DB cũng chặn bằng CHECK).
 * LƯU Ý: chỉ lưu link + trích dẫn, KHÔNG scrape media về —
 * chờ kết quả Spike 1 (pháp lý oEmbed) trước khi nhúng player.
 */
export class SeedContentDto {
  /** Tên quán trong cùng payload hoặc đã có trong DB — resolve theo tên */
  @IsString()
  restaurantName: string;

  @IsIn(['video', 'image', 'text'])
  mediaType: 'video' | 'image' | 'text';

  @IsOptional()
  @IsString()
  caption?: string;

  @IsIn(['tiktok', 'threads'])
  sourcePlatform: 'tiktok' | 'threads';

  @IsUrl()
  sourceUrl: string;

  @IsString()
  sourceAuthor: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  occasions?: string[];
}

export class SeedPayloadDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedUserDto)
  users?: SeedUserDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRestaurantDto)
  restaurants?: CreateRestaurantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedContentDto)
  contents?: SeedContentDto[];
}
