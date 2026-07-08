import { AdminService } from './admin.service';

/** Tuân thủ Spike 1 ở seed tool: post Threads không được lưu caption */

function makeService() {
  const savedContents: any[] = [];
  const contents = {
    findOneBy: jest.fn(async () => null),
    create: (c: any) => c,
    save: jest.fn(async (c: any) => {
      savedContents.push(c);
      return c;
    }),
  };
  const users = {
    findOneBy: jest.fn(async () => null),
    create: (u: any) => u,
    save: jest.fn(async (u: any) => ({ ...u, id: 'user-uuid-test' })),
  };
  const restaurants = {
    findByName: jest.fn(async () => ({ id: 'r1', name: 'Quán Test' })),
  };
  const search = { reindex: jest.fn(async () => ({ indexed: 1 })) };
  const service = new AdminService(
    restaurants as any,
    search as any,
    contents as any,
    users as any,
  );
  return { service, savedContents };
}

describe('AdminService.seed — tuân thủ Threads', () => {
  it('post threads: caption bị ép null dù seed file có gửi', async () => {
    const { service, savedContents } = makeService();
    await service.seed({
      contents: [
        {
          restaurantName: 'Quán Test',
          mediaType: 'text',
          caption: 'nội dung copy từ threads — KHÔNG ĐƯỢC LƯU',
          sourcePlatform: 'threads',
          sourceUrl: 'https://www.threads.net/@x/post/1',
          sourceAuthor: '@x',
        },
      ],
    } as any);
    expect(savedContents[0].caption).toBeNull();
    expect(savedContents[0].sourceUrl).toBe('https://www.threads.net/@x/post/1');
  });

  it('post tiktok: caption trích dẫn giữ nguyên (được phép)', async () => {
    const { service, savedContents } = makeService();
    await service.seed({
      contents: [
        {
          restaurantName: 'Quán Test',
          mediaType: 'video',
          caption: 'trích dẫn tiktok',
          sourcePlatform: 'tiktok',
          sourceUrl: 'https://www.tiktok.com/@y/video/2',
          sourceAuthor: '@y',
        },
      ],
    } as any);
    expect(savedContents[0].caption).toBe('trích dẫn tiktok');
  });
});
