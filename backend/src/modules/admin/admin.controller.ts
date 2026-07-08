import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/admin.guard';
import { AdminService } from './admin.service';
import { SeedPayloadDto } from './dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  /**
   * Nạp hàng loạt: users + quán + nội dung tổng hợp (có trích dẫn nguồn).
   * curl -X POST http://localhost:3000/admin/seed \
   *   -H "content-type: application/json" -H "x-admin-key: $ADMIN_KEY" \
   *   -d @seed/quan7.json
   */
  @Post('seed')
  seed(@Body() payload: SeedPayloadDto) {
    return this.service.seed(payload);
  }
}
