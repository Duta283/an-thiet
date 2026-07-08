import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUserId } from '../../common/auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Danh tính hiện tại — mobile gọi sau khi đăng nhập để lấy users.id
   * (đồng thời trigger auto-provision với user mới).
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUserId() userId: string) {
    const user = await this.auth.findById(userId);
    if (!user) throw new NotFoundException('User không tồn tại');
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      trustScore: user.trustScore,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    };
  }
}
