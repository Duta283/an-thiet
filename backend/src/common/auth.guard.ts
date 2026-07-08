import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service';

/**
 * Guard auth hợp nhất:
 * - AUTH_MODE=firebase: verify `Authorization: Bearer <Firebase ID token>`,
 *   auto-provision user lần đầu.
 * - AUTH_MODE=dev (mặc định local): nhận header `x-user-id` như cũ —
 *   CHỈ dùng nội bộ, không bao giờ bật ở môi trường có traffic thật.
 *
 * Controllers giữ nguyên decorator CurrentUserId — đúng thiết kế ban đầu
 * (đổi cơ chế auth không phải sửa controller).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    if (this.auth.devMode) {
      const userId = req.headers['x-user-id'];
      if (!userId || typeof userId !== 'string') {
        throw new UnauthorizedException('Thiếu header x-user-id (AUTH_MODE=dev)');
      }
      req.userId = userId;
      return true;
    }

    req.userId = await this.auth.resolveUserId(req.headers['authorization']);
    return true;
  }
}

export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest().userId,
);
