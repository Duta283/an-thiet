import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { OembedService } from './oembed.service';

@Controller()
export class OembedController {
  constructor(private readonly service: OembedService) {}

  /** Nội dung post tổng hợp lấy tươi từ nền tảng gốc (có cache TTL 24h) */
  @Get('contents/:id/oembed')
  forContent(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.forContent(id);
  }
}
