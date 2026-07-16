import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MediaService } from './media.service';

function makeFile(over: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'a.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('x'),
    ...over,
  } as Express.Multer.File;
}

describe('MediaService.upload', () => {
  beforeEach(() => {
    process.env.R2_ENDPOINT = 'https://acc.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'k';
    process.env.R2_SECRET_ACCESS_KEY = 's';
    process.env.R2_BUCKET = 'angita-media';
    process.env.R2_PUBLIC_URL = 'https://pub-abc.r2.dev/';
  });
  afterEach(() => {
    for (const k of ['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET','R2_PUBLIC_URL']) delete process.env[k];
  });

  function makeService() {
    const service = new MediaService();
    const send = jest.fn(async () => ({}));
    (service as any).client = { send };
    return { service, send };
  }

  it('upload jpeg → URL public đúng dạng, không double slash', async () => {
    const { service, send } = makeService();
    const { url } = await service.upload(makeFile());
    expect(url).toMatch(/^https:\/\/pub-abc\.r2\.dev\/checkins\/[0-9a-f-]+\.jpg$/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('chặn mimetype lạ', async () => {
    const { service } = makeService();
    await expect(
      service.upload(makeFile({ mimetype: 'application/pdf' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('chặn file quá 8MB', async () => {
    const { service } = makeService();
    await expect(
      service.upload(makeFile({ size: 9 * 1024 * 1024 })),
    ).rejects.toThrow(BadRequestException);
  });

  it('thiếu file → BadRequest', async () => {
    const { service } = makeService();
    await expect(service.upload(undefined as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('thiếu env R2 → 503 rõ ràng', async () => {
    delete process.env.R2_ENDPOINT;
    const service = new MediaService();
    await expect(service.upload(makeFile())).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
