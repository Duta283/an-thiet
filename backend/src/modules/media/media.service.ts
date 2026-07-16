import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Upload ảnh check-in lên Cloudflare R2 (S3-compatible).
 * DB chỉ lưu URL public — đúng stack PO chốt (R2 + CDN, egress miễn phí).
 */

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_BYTES = 8 * 1024 * 1024;

@Injectable()
export class MediaService {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!this.client) {
      const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
        process.env;
      if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new ServiceUnavailableException(
          'Chưa cấu hình R2 (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)',
        );
      }
      this.client = new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });
    }
    return this.client;
  }

  async upload(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Thiếu file (field name: "file")');
    const ext = ALLOWED[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Chỉ nhận ảnh JPEG/PNG/WebP — nhận được ${file.mimetype}`,
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Ảnh tối đa 8MB');
    }
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucket || !publicUrl) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình R2_BUCKET / R2_PUBLIC_URL',
      );
    }

    const key = `checkins/${randomUUID()}.${ext}`;
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { url: `${publicUrl.replace(/\/$/, '')}/${key}` };
  }
}
