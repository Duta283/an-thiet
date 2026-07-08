import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OembedService } from './oembed.service';

/** Test tuân thủ Spike 1: oEmbed lúc hiển thị, cache, không phụ thuộc mạng thật */

const TIKTOK_CONTENT = {
  id: 'c1',
  origin: 'aggregated',
  sourcePlatform: 'tiktok',
  sourceUrl: 'https://www.tiktok.com/@a/video/1',
};
const THREADS_CONTENT = {
  id: 'c2',
  origin: 'aggregated',
  sourcePlatform: 'threads',
  sourceUrl: 'https://www.threads.net/@b/post/2',
};

function makeService(content: any) {
  const contents = { findOneBy: jest.fn(async () => content) };
  return new OembedService(contents as any);
}

function mockFetchOnce(body: unknown, ok = true) {
  (global as any).fetch = jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OembedService', () => {
  it('TikTok: normalize author/title/html, không cần token', async () => {
    mockFetchOnce({
      author_name: '@foodreview',
      title: 'Bún mắm đỉnh',
      html: '<blockquote>...</blockquote>',
      thumbnail_url: 'https://t.tiktok.com/x.jpg',
    });
    const s = makeService(TIKTOK_CONTENT);
    const r = await s.forContent('c1');
    expect(r).toEqual({
      provider: 'tiktok',
      authorName: '@foodreview',
      text: 'Bún mắm đỉnh',
      html: '<blockquote>...</blockquote>',
      thumbnailUrl: 'https://t.tiktok.com/x.jpg',
    });
  });

  it('cache: lần 2 cùng URL không gọi mạng lại', async () => {
    mockFetchOnce({ author_name: 'a', title: 't', html: 'h' });
    const s = makeService(TIKTOK_CONTENT);
    await s.forContent('c1');
    await s.forContent('c1');
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('Threads: gọi endpoint tokenless v1.0, KHÔNG kèm access_token (PO đã xác nhận 200)', async () => {
    mockFetchOnce({ author_name: '@b', html: '<blockquote>embed</blockquote>' });
    const s = makeService(THREADS_CONTENT);
    const r = await s.forContent('c2');
    expect(r.provider).toBe('threads');
    expect(r.text).toBeNull(); // không tách lưu nội dung — chỉ render embed
    expect(r.html).toContain('embed');
    const url = ((global as any).fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('graph.threads.net/v1.0/oembed');
    expect(url).not.toContain('access_token');
  });

  it('provider lỗi → 503, không crash', async () => {
    mockFetchOnce({}, false);
    const s = makeService(TIKTOK_CONTENT);
    await expect(s.forContent('c1')).rejects.toThrow(ServiceUnavailableException);
  });

  it('từ chối content không phải aggregated', async () => {
    const s = makeService({ id: 'c3', origin: 'user_generated', sourceUrl: null });
    await expect(s.forContent('c3')).rejects.toThrow(BadRequestException);
  });
});
