import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/admin.guard';
import { TrustService } from './trust.service';

@Controller()
export class TrustController {
  constructor(private readonly service: TrustService) {}

  /** Điểm tin cậy + breakdown diễn giải được — để debug & giải thích với user */
  @Get('users/:id/trust')
  getTrust(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.computeForUser(id);
  }

  /** Recompute toàn bộ (admin) — chạy sau mỗi đợt seed hoặc theo lịch */
  @Post('admin/trust/recompute')
  @UseGuards(AdminGuard)
  recomputeAll() {
    return this.service.recomputeAll();
  }
}
