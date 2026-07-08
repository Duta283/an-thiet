import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../modules/auth/auth.service';

/**
 * Test AuthGuard + logic resolve/auto-provision của AuthService.
 * Firebase verifyIdToken được mock — không gọi mạng.
 */

function ctxWithHeaders(headers: Record<string, string>): {
  ctx: ExecutionContext;
  req: any;
} {
  const req: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard — AUTH_MODE=dev', () => {
  const auth = { devMode: true } as unknown as AuthService;
  const guard = new AuthGuard(auth);

  it('pass với x-user-id, gắn req.userId', async () => {
    const { ctx, req } = ctxWithHeaders({ 'x-user-id': 'u-123' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.userId).toBe('u-123');
  });

  it('chặn khi thiếu x-user-id', async () => {
    const { ctx } = ctxWithHeaders({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthGuard — AUTH_MODE=firebase', () => {
  it('gọi resolveUserId với header authorization và gắn kết quả', async () => {
    const auth = {
      devMode: false,
      resolveUserId: jest.fn(async () => 'user-uuid-1'),
    } as unknown as AuthService;
    const guard = new AuthGuard(auth);
    const { ctx, req } = ctxWithHeaders({ authorization: 'Bearer token123' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.userId).toBe('user-uuid-1');
    expect((auth as any).resolveUserId).toHaveBeenCalledWith('Bearer token123');
  });
});

describe('AuthService.resolveUserId', () => {
  function makeService(opts: {
    existingUser?: { id: string } | null;
    decoded?: Record<string, unknown>;
    verifyThrows?: boolean;
  }) {
    const saved: any[] = [];
    const users = {
      findOneBy: jest.fn(async () => opts.existingUser ?? null),
      create: (u: any) => u,
      save: jest.fn(async (u: any) => {
        const withId = { ...u, id: 'new-user-uuid' };
        saved.push(withId);
        return withId;
      }),
    };
    const service = new AuthService(users as any);
    // Mock lớp Firebase — không init app thật
    (service as any).firebase = () => ({
      auth: () => ({
        verifyIdToken: async () => {
          if (opts.verifyThrows) throw new Error('invalid');
          return opts.decoded ?? { uid: 'fb-uid-1' };
        },
      }),
    });
    return { service, users, saved };
  }

  beforeEach(() => {
    process.env.AUTH_MODE = 'firebase';
  });
  afterEach(() => {
    delete process.env.AUTH_MODE;
  });

  it('chặn khi thiếu Bearer', async () => {
    const { service } = makeService({});
    await expect(service.resolveUserId(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.resolveUserId('Basic abc')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('chặn khi token không verify được', async () => {
    const { service } = makeService({ verifyThrows: true });
    await expect(service.resolveUserId('Bearer bad')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('trả về id user đã tồn tại (không tạo mới)', async () => {
    const { service, users } = makeService({
      existingUser: { id: 'existing-uuid' },
    });
    await expect(service.resolveUserId('Bearer ok')).resolves.toBe(
      'existing-uuid',
    );
    expect((users as any).save).not.toHaveBeenCalled();
  });

  it('auto-provision user mới từ token claims', async () => {
    const { service, saved } = makeService({
      decoded: {
        uid: 'fb-uid-9',
        name: 'Tân Nguyễn',
        email: 'tan@example.com',
        picture: 'https://example.com/a.png',
      },
    });
    await expect(service.resolveUserId('Bearer ok')).resolves.toBe(
      'new-user-uuid',
    );
    expect(saved[0]).toMatchObject({
      firebaseUid: 'fb-uid-9',
      displayName: 'Tân Nguyễn',
      avatarUrl: 'https://example.com/a.png',
    });
  });

  it('fallback displayName từ email khi token không có name', async () => {
    const { service, saved } = makeService({
      decoded: { uid: 'fb-uid-10', email: 'thuckhach@example.com' },
    });
    await service.resolveUserId('Bearer ok');
    expect(saved[0].displayName).toBe('thuckhach');
  });
});
