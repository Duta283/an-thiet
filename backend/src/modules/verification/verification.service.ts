import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Content } from '../../entities/content.entity';
import { Restaurant } from '../../entities/restaurant.entity';
import {
  Verification,
  VerificationResult,
} from '../../entities/verification.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { CheckinDto } from './dto';

// ----- Ngưỡng v0 — chỉnh sau khi có dữ liệu spike GPS (mục 7.1) -----
/** GPS accuracy tệ hơn mức này thì không tin được */
const MAX_ACCURACY_M = 50;
/** Khoảng cách tối đa tính là "ở quán" (cộng thêm accuracy) */
const MAX_DISTANCE_M = 100;
/** Tốc độ di chuyển bất hợp lý giữa 2 check-in (km/h) */
const IMPOSSIBLE_SPEED_KMH = 120;
/** EXIF: ảnh phải chụp trong vòng N giờ và cách quán tối đa M mét */
const EXIF_MAX_AGE_H = 2;
const EXIF_MAX_DISTANCE_M = 150;

interface GpsEvidence {
  lat: number;
  lng: number;
  accuracy: number;
  distanceM: number;
  checkedAt: string;
  [key: string]: unknown;
}

/** Haversine — đủ chính xác ở khoảng cách check-in (<1km) */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,
    @InjectRepository(Content)
    private readonly contents: Repository<Content>,
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * Check-in xác thực v0 (Sprint 5): GPS + ảnh geotag.
   * Tạo 1 content user_generated + 1-2 bản ghi verification.
   *
   * Lớp phòng vệ v0 (mục 4.1):
   *  1. accuracy radius   2. khoảng cách tới quán
   *  3. impossible travel 4. (TODO Spike 2) Play Integrity / DeviceCheck
   */
  async checkin(userId: string, dto: CheckinDto) {
    const restaurant = await this.restaurants.findOneBy({
      id: dto.restaurantId,
    });
    if (!restaurant) throw new NotFoundException('Không tìm thấy quán');

    const content = await this.contents.save(
      this.contents.create({
        restaurantId: dto.restaurantId,
        userId,
        mediaType: dto.mediaType ?? 'text',
        caption: dto.caption ?? null,
        origin: 'user_generated',
        occasions: dto.occasions ?? [],
      }),
    );

    const results: Verification[] = [];
    results.push(await this.verifyGps(userId, content.id, restaurant, dto));
    if (dto.exif) {
      results.push(this.buildExifVerification(content.id, restaurant, dto));
    }
    const saved = await this.verifications.save(
      results.filter((v) => v.method !== 'gps'), // gps đã save trong verifyGps
    );

    const all = [results[0], ...saved];
    const isVerified = all.some((v) => v.result === 'passed');

    this.analytics.track('checkin_completed', {
      userId,
      properties: {
        restaurantId: dto.restaurantId,
        isVerified,
        methods: all.map((v) => `${v.method}:${v.result}`),
      },
    });

    return {
      contentId: content.id,
      isVerified,
      verifications: all.map((v) => ({
        method: v.method,
        result: v.result,
        confidence: v.confidence,
      })),
    };
  }

  private async verifyGps(
    userId: string,
    contentId: string,
    restaurant: Restaurant,
    dto: CheckinDto,
  ): Promise<Verification> {
    const distanceM = haversineM(
      dto.lat,
      dto.lng,
      restaurant.lat,
      restaurant.lng,
    );
    const reasons: string[] = [];
    let result: VerificationResult = 'passed';
    let confidence = 0.9;

    if (dto.accuracy > MAX_ACCURACY_M) {
      result = 'failed';
      reasons.push(`accuracy ${dto.accuracy}m > ${MAX_ACCURACY_M}m`);
    }
    if (distanceM > MAX_DISTANCE_M + dto.accuracy) {
      result = 'failed';
      reasons.push(`cách quán ${Math.round(distanceM)}m — quá xa`);
    }

    // Impossible travel: so với lần check-in GPS passed gần nhất của user
    const last = await this.verifications
      .createQueryBuilder('v')
      .innerJoin(Content, 'c', 'c.id = v.content_id')
      .where('c.user_id = :userId', { userId })
      .andWhere("v.method = 'gps'")
      .andWhere("v.result = 'passed'")
      .orderBy('v.created_at', 'DESC')
      .getOne();
    if (last?.rawEvidence) {
      const prev = last.rawEvidence as unknown as GpsEvidence;
      const dtHours =
        (Date.now() - new Date(prev.checkedAt).getTime()) / 3_600_000;
      if (dtHours > 0) {
        const distKm = haversineM(dto.lat, dto.lng, prev.lat, prev.lng) / 1000;
        const speed = distKm / dtHours;
        if (speed > IMPOSSIBLE_SPEED_KMH) {
          result = 'failed';
          reasons.push(
            `impossible travel: ${Math.round(speed)}km/h so với check-in trước`,
          );
        }
      }
    }

    // Accuracy càng tệ, confidence càng giảm
    if (result === 'passed') {
      confidence = Math.max(
        0.5,
        0.95 - (dto.accuracy / MAX_ACCURACY_M) * 0.3,
      );
    } else {
      confidence = 0;
    }

    const evidence: GpsEvidence = {
      lat: dto.lat,
      lng: dto.lng,
      accuracy: dto.accuracy,
      distanceM: Math.round(distanceM),
      checkedAt: new Date().toISOString(),
      reasons,
      integrityToken: dto.integrityToken ?? null, // TODO(Spike 2): verify server-side
    };

    return this.verifications.save(
      this.verifications.create({
        contentId,
        method: 'gps',
        result,
        confidence,
        rawEvidence: evidence,
      }),
    );
  }

  private buildExifVerification(
    contentId: string,
    restaurant: Restaurant,
    dto: CheckinDto,
  ): Verification {
    const exif = dto.exif!;
    const distanceM = haversineM(exif.lat, exif.lng, restaurant.lat, restaurant.lng);
    const ageH = (Date.now() - new Date(exif.takenAt).getTime()) / 3_600_000;
    const reasons: string[] = [];
    let result: VerificationResult = 'passed';

    if (distanceM > EXIF_MAX_DISTANCE_M) {
      result = 'failed';
      reasons.push(`EXIF cách quán ${Math.round(distanceM)}m`);
    }
    if (ageH < 0 || ageH > EXIF_MAX_AGE_H) {
      result = 'failed';
      reasons.push(`ảnh chụp cách đây ${ageH.toFixed(1)}h`);
    }

    return this.verifications.create({
      contentId,
      method: 'exif',
      result,
      confidence: result === 'passed' ? 0.8 : 0,
      rawEvidence: { ...exif, distanceM: Math.round(distanceM), reasons },
    });
  }

  /** QR hoá đơn — giai đoạn Cộng đồng gốc (tháng 4-9), sau spike OCR */
  async submitQr(): Promise<never> {
    throw new BadRequestException(
      'QR hoá đơn chưa mở ở MVP — theo roadmap triển khai sau pilot (mục 4.1)',
    );
  }
}
