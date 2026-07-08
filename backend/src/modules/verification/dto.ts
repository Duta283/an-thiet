import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExifEvidenceDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  /** Thời gian chụp từ EXIF (ISO 8601). App tự chụp trong luồng check-in để giữ EXIF gốc. */
  @IsISO8601()
  takenAt: string;
}

export class CheckinDto {
  @IsUUID()
  restaurantId: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  /** Accuracy radius (mét) từ thiết bị */
  @IsNumber()
  @Min(0)
  accuracy: number;

  @IsOptional()
  @IsIn(['video', 'image', 'text'])
  mediaType?: 'video' | 'image' | 'text';

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  occasions?: string[];

  /** EXIF ảnh chụp tại chỗ (nếu có) — chạy song song GPS theo mục 4.1 */
  @IsOptional()
  @ValidateNested()
  @Type(() => ExifEvidenceDto)
  exif?: ExifEvidenceDto;

  /**
   * TODO(Spike 2): token Play Integrity (Android) / DeviceCheck (iOS).
   * Nhận sẵn từ v0 để client tích hợp sớm; server verify ở sprint 5.
   */
  @IsOptional()
  @IsString()
  integrityToken?: string;
}
