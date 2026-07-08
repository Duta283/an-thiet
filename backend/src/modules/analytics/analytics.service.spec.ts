import { AnalyticsService } from './analytics.service';

function makeService() {
  const inserted: any[] = [];
  const events = {
    create: (r: any) => r,
    save: jest.fn(async (rows: any) => {
      inserted.push(...(Array.isArray(rows) ? rows : [rows]));
      return rows;
    }),
  };
  const service = new AnalyticsService(events as any, {} as any);
  return { service, events, inserted };
}

describe('AnalyticsService.track', () => {
  it('fire-and-forget: insert đúng payload', async () => {
    const { service, inserted } = makeService();
    service.track('search', {
      userId: 'u1',
      properties: { q: 'bún', found: 3 },
    });
    await new Promise((r) => setImmediate(r));
    expect(inserted[0]).toMatchObject({
      name: 'search',
      userId: 'u1',
      properties: { q: 'bún', found: 3 },
    });
  });

  it('không throw khi DB lỗi (tracking không làm hỏng request chính)', async () => {
    const events = {
      create: (r: any) => r,
      save: jest.fn(async () => {
        throw new Error('db down');
      }),
    };
    const service = new AnalyticsService(events as any, {} as any);
    expect(() => service.track('follow', { userId: 'u1' })).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});

describe('AnalyticsService.ingest', () => {
  it('gắn userId/anonId cho cả batch, giới hạn 100', async () => {
    const { service, inserted } = makeService();
    const res = await service.ingest(
      [
        { name: 'app_session_start' },
        { name: 'screen_view', properties: { screen: 'Search' } },
      ],
      { userId: null, anonId: 'anon-1' },
    );
    expect(res.accepted).toBe(2);
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({ name: 'app_session_start', anonId: 'anon-1', userId: null });
    expect(inserted[1]).toMatchObject({ properties: { screen: 'Search' } });
  });

  it('batch rỗng → accepted 0, không chạm DB', async () => {
    const { service, events } = makeService();
    const res = await service.ingest([], { anonId: 'a' });
    expect(res.accepted).toBe(0);
    expect(events.save).not.toHaveBeenCalled();
  });
});
