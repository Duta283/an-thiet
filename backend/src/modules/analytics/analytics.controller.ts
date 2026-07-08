import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/admin.guard';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';
import { IngestEventsDto } from './dto';

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Nhận batch event từ mobile. Auth "mềm": đăng nhập thì gắn userId,
   * chưa đăng nhập thì nhận x-anon-id — không chặn (session trước đăng nhập
   * cũng là dữ liệu retention quan trọng).
   */
  @Post('events')
  async ingest(
    @Body() dto: IngestEventsDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-user-id') devUserId?: string,
    @Headers('x-anon-id') anonId?: string,
  ) {
    let userId: string | null = null;
    try {
      if (this.auth.devMode) {
        userId = devUserId ?? null;
      } else if (authorization) {
        userId = await this.auth.resolveUserId(authorization);
      }
    } catch {
      userId = null; // token hỏng → vẫn nhận event như anon
    }
    return this.analytics.ingest(dto.events, { userId, anonId: anonId ?? null });
  }

  /** Dashboard chỉ số pilot (mục 8) — đọc bằng admin key */
  @Get('admin/metrics')
  @UseGuards(AdminGuard)
  metrics() {
    return this.analytics.metrics();
  }
}
