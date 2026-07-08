import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  area: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisineTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMax?: number;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsIn(['manual', 'google_places'])
  source?: 'manual' | 'google_places';

  @IsOptional()
  @IsString()
  sourceRef?: string;
}

export class ListRestaurantsQuery {
  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  /** bán kính mét, mặc định 3000 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  radius?: number;
}
