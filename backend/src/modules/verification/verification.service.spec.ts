import { BadRequestException } from '@nestjs/common';
import { Restaurant } from '../../entities/restaurant.entity';
import { CheckinDto } from './dto';
import { haversineM, VerificationService } from './verification.service';

/**
 * Unit test cho logic verification v0 (yêu cầu đánh giá Sprint 0, mục 3).
 * Các ngưỡng (50m accuracy, 100m khoảng cách, 120km/h, EXIF 2h/150m)
 * SẼ chỉnh sau Spike 2 — test này là lưới an toàn khi chỉnh.
 */

// Quán mẫu: Bún Mắm Cô Ba (Quận 7)
const RESTAURANT = {
  id: 'r1',
  name: 'Bún Mắm Cô Ba',
  lat: 10.7286,
  lng: 106.7189,
} as Restaurant;

/** Dịch chuyển ~theo mét quanh toạ độ quán (xấp xỉ đủ tốt cho test) */
function offsetM(lat: number, lng: number, dLatM: number, dLngM: number) {
  return {
    lat: lat + dLatM / 111_320,
    lng: lng + dLngM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

function makeService(opts: { lastGpsEvidence?: Record<string, unknown> } = {}) {
  const savedVerifications: any[] = [];
  const verifications = {
    create: (v: any) => v,
    save: jest.fn(async (v: any) => {
      const arr = Array.isArray(v) ? v : [v];
      savedVerifications.push(...arr);
      return v;
    }),
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () =>
        opts.lastGpsEvidence
          ? { rawEvidence: opts.lastGpsEvidence }
          : null,
      ),
    })),
  };
  const contents = {
    create: (c: any) => c,
    save: jest.fn(async (c: any) => ({ ...c, id: 'c1' })),
  };
  const restaurants = {
    findOneBy: jest.fn(async ({ id }: any) =>
      id === RESTAURANT.id ? RESTAURANT : null,
    ),
  };
  const analytics = { track: jest.fn() };
  const service = new VerificationService(
    verifications as any,
    contents as any,
    restaurants as any,
    analytics as any,
  );
  return { service, savedVerifications, analytics };
}

function baseDto(over: Partial<CheckinDto> = {}): CheckinDto {
  return {
    restaurantId: RESTAURANT.id,
    lat: RESTAURANT.lat,
    lng: RESTAURANT.lng,
    accuracy: 10,
    ...over,
  } as CheckinDto;
}

describe('haversineM', () => {
  it('khoảng cách 0 khi cùng toạ độ', () => {
    expect(haversineM(10.7286, 106.7189, 10.7286, 106.7189)).toBe(0);
  });

  it('xấp xỉ 111.32km cho 1 độ vĩ tuyến', () => {
    const d = haversineM(10, 106, 11, 106);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  it('offset 100m cho ra ~100m', () => {
    const p = offsetM(RESTAURANT.lat, RESTAURANT.lng, 100, 0);
    const d = haversineM(RESTAURANT.lat, RESTAURANT.lng, p.lat, p.lng);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });
});

describe('GPS check-in v0', () => {
  it('PASS khi đứng tại quán, accuracy tốt (+track checkin_completed)', async () => {
    const { service, analytics } = makeService();
    const res = await service.checkin('u1', baseDto());
    expect(res.isVerified).toBe(true);
    expect(analytics.track).toHaveBeenCalledWith(
      'checkin_completed',
      expect.objectContaining({
        userId: 'u1',
        properties: expect.objectContaining({ isVerified: true }),
      }),
    );
    const gps = res.verifications.find((v) => v.method === 'gps')!;
    expect(gps.result).toBe('passed');
    expect(gps.confidence).toBeGreaterThanOrEqual(0.5);
    expect(gps.confidence).toBeLessThanOrEqual(0.95);
  });

  it('FAIL khi accuracy quá tệ (>50m)', async () => {
    const { service } = makeService();
    const res = await service.checkin('u1', baseDto({ accuracy: 80 }));
    const gps = res.verifications.find((v) => v.method === 'gps')!;
    expect(gps.result).toBe('failed');
    expect(gps.confidence).toBe(0);
  });

  it('FAIL khi cách quán quá xa (500m)', async () => {
    const { service } = makeService();
    const p = offsetM(RESTAURANT.lat, RESTAURANT.lng, 500, 0);
    const res = await service.checkin('u1', baseDto({ lat: p.lat, lng: p.lng }));
    const gps = res.verifications.find((v) => v.method === 'gps')!;
    expect(gps.result).toBe('failed');
  });

  it('PASS khi lệch trong biên (60m, accuracy 20m → 100+20 ≥ 60)', async () => {
    const { service } = makeService();
    const p = offsetM(RESTAURANT.lat, RESTAURANT.lng, 60, 0);
    const res = await service.checkin(
      'u1',
      baseDto({ lat: p.lat, lng: p.lng, accuracy: 20 }),
    );
    const gps = res.verifications.find((v) => v.method === 'gps')!;
    expect(gps.result).toBe('passed');
  });

  it('FAIL impossible travel: check-in trước cách 100km mới 10 phút (~600km/h)', async () => {
    const { service } = makeService({
      lastGpsEvidence: {
        lat: 11.6,   // ~100km về phía bắc
        lng: 106.7189,
        checkedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
    });
    const res = await service.checkin('u1', baseDto());
    const gps = res.verifications.find((v) => v.method === 'gps')!;
    expect(gps.result).toBe('failed');
  });

  it('PASS khi check-in trước đó đủ xa về thời gian (100km / 2 ngày)', async () => {
    const { service } = makeService({
      lastGpsEvidence: {
        lat: 11.6,
        lng: 106.7189,
        checkedAt: new Date(Date.now() - 48 * 3_600_000).toISOString(),
      },
    });
    const res = await service.checkin('u1', baseDto());
    const gps = res.verifications.find((v) => v.method === 'gps')!;
    expect(gps.result).toBe('passed');
  });

  it('confidence giảm khi accuracy tệ hơn (nhưng vẫn pass)', async () => {
    const { service: s1 } = makeService();
    const { service: s2 } = makeService();
    const good = await s1.checkin('u1', baseDto({ accuracy: 5 }));
    const worse = await s2.checkin('u1', baseDto({ accuracy: 45 }));
    const c1 = good.verifications.find((v) => v.method === 'gps')!.confidence!;
    const c2 = worse.verifications.find((v) => v.method === 'gps')!.confidence!;
    expect(c1).toBeGreaterThan(c2);
    expect(c2).toBeGreaterThanOrEqual(0.5);
  });
});

describe('EXIF (ảnh geotag) v0', () => {
  it('PASS: ảnh mới chụp tại quán', async () => {
    const { service } = makeService();
    const res = await service.checkin(
      'u1',
      baseDto({
        exif: {
          lat: RESTAURANT.lat,
          lng: RESTAURANT.lng,
          takenAt: new Date(Date.now() - 10 * 60_000).toISOString(),
        },
      }),
    );
    const exif = res.verifications.find((v) => v.method === 'exif')!;
    expect(exif.result).toBe('passed');
    expect(exif.confidence).toBe(0.8);
  });

  it('FAIL: ảnh chụp quá lâu (5h trước)', async () => {
    const { service } = makeService();
    const res = await service.checkin(
      'u1',
      baseDto({
        exif: {
          lat: RESTAURANT.lat,
          lng: RESTAURANT.lng,
          takenAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
        },
      }),
    );
    const exif = res.verifications.find((v) => v.method === 'exif')!;
    expect(exif.result).toBe('failed');
  });

  it('FAIL: EXIF cách quán 400m', async () => {
    const { service } = makeService();
    const p = offsetM(RESTAURANT.lat, RESTAURANT.lng, 400, 0);
    const res = await service.checkin(
      'u1',
      baseDto({
        exif: {
          lat: p.lat,
          lng: p.lng,
          takenAt: new Date().toISOString(),
        },
      }),
    );
    const exif = res.verifications.find((v) => v.method === 'exif')!;
    expect(exif.result).toBe('failed');
  });

  it('GPS fail + EXIF pass → content vẫn isVerified (2 phương thức độc lập)', async () => {
    const { service } = makeService();
    const res = await service.checkin(
      'u1',
      baseDto({
        accuracy: 80, // GPS fail
        exif: {
          lat: RESTAURANT.lat,
          lng: RESTAURANT.lng,
          takenAt: new Date().toISOString(),
        },
      }),
    );
    expect(res.verifications.find((v) => v.method === 'gps')!.result).toBe('failed');
    expect(res.verifications.find((v) => v.method === 'exif')!.result).toBe('passed');
    expect(res.isVerified).toBe(true);
  });
});

describe('QR hoá đơn', () => {
  it('chưa mở ở MVP — trả BadRequest', async () => {
    const { service } = makeService();
    await expect(service.submitQr()).rejects.toThrow(BadRequestException);
  });
});
