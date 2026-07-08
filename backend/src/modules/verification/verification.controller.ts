import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUserId } from '../../common/auth.guard';
import { CheckinDto } from './dto';
import { VerificationService } from './verification.service';

@Controller('verifications')
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  /** Check-in xác thực: GPS bắt buộc, EXIF tuỳ chọn (2 trong 3 phương thức v0) */
  @Post('checkin')
  @UseGuards(AuthGuard)
  checkin(@CurrentUserId() userId: string, @Body() dto: CheckinDto) {
    return this.service.checkin(userId, dto);
  }

  /** Placeholder — QR hoá đơn mở sau pilot */
  @Post('qr')
  @UseGuards(AuthGuard)
  qr() {
    return this.service.submitQr();
  }
}
