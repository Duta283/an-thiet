import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Bảo vệ API admin/seed bằng header `x-admin-key`.
 * Đủ dùng cho công cụ nội bộ giai đoạn Seed (0-3 tháng);
 * thay bằng auth thật khi có admin UI công khai.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_KEY) {
      throw new UnauthorizedException('x-admin-key không hợp lệ');
    }
    return true;
  }
}
