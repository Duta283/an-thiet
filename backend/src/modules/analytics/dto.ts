import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

/**
 * Event client được phép gửi. Server-truth events (search, checkin_completed,
 * follow) do backend tự track — client gửi sẽ bị từ chối để số liệu không nhiễu.
 */
export const CLIENT_EVENT_NAMES = ['app_session_start', 'screen_view'] as const;

export class ClientEventDto {
  @IsIn(CLIENT_EVENT_NAMES)
  name: (typeof CLIENT_EVENT_NAMES)[number];

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}

export class IngestEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientEventDto)
  events: ClientEventDto[];
}
