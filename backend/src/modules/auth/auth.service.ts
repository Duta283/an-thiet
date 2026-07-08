import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

/**
 * Auth thật (Sprint 4, mục 3 tài liệu định hướng): Firebase Auth.
 * - Không tự build hệ thống auth — verify ID token do Firebase cấp.
 * - Auto-provision: lần đầu token hợp lệ gọi API, tạo luôn users row
 *   (map qua firebase_uid) — không cần endpoint đăng ký riêng.
 * - AUTH_MODE=dev giữ lối vào x-user-id cho local/staging nội bộ.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private app: admin.app.App | null = null;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  get devMode(): boolean {
    return (process.env.AUTH_MODE ?? 'dev') !== 'firebase';
  }

  private firebase(): admin.app.App {
    if (!this.app) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
          'AUTH_MODE=firebase nhưng thiếu FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY',
        );
      }
      this.app =
        admin.apps.length > 0
          ? admin.app()
          : admin.initializeApp({
              credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
              }),
            });
    }
    return this.app;
  }

  /**
   * Verify Bearer token → trả về users.id (tạo user nếu lần đầu).
   * Controllers không biết gì về Firebase — chỉ nhận userId qua decorator.
   */
  async resolveUserId(authorization?: string): Promise<string> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu header Authorization: Bearer <idToken>');
    }
    const idToken = authorization.slice('Bearer '.length);

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await this.firebase().auth().verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('ID token không hợp lệ hoặc đã hết hạn');
    }

    const existing = await this.users.findOneBy({ firebaseUid: decoded.uid });
    if (existing) return existing.id;

    // Auto-provision lần đầu
    const created = await this.users.save(
      this.users.create({
        firebaseUid: decoded.uid,
        displayName:
          (decoded.name as string | undefined) ??
          decoded.email?.split('@')[0] ??
          'Thực khách mới',
        avatarUrl: (decoded.picture as string | undefined) ?? null,
      }),
    );
    this.logger.log(`Provision user mới ${created.id} (uid=${decoded.uid})`);
    return created.id;
  }

  findById(id: string) {
    return this.users.findOneBy({ id });
  }
}
