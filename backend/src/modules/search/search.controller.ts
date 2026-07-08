import { Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/admin.guard';
import { AnalyticsService } from '../analytics/analytics.service';
import { SearchService } from './search.service';

@Controller()
export class SearchController {
  constructor(
    private readonly service: SearchService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** GET /search?q=bún&area=quan-7&cuisine=bun&occasion=an-khuya&priceMax=60000&lat=&lng=&radiusKm= */
  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('area') area?: string,
    @Query('cuisine') cuisine?: string,
    @Query('occasion') occasion?: string,
    @Query('priceMax') priceMax?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Headers('x-anon-id') anonId?: string,
    @Headers('x-user-id') devUserId?: string,
  ) {
    const result = await this.service.search({
      q,
      area,
      cuisine,
      occasion,
      priceMax: priceMax ? Number(priceMax) : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
    });
    // Track server-side — không phụ thuộc client gửi event (mục 8 concept)
    this.analytics.track('search', {
      userId: devUserId ?? null,
      anonId: anonId ?? null,
      properties: { q, area, cuisine, occasion, priceMax, found: result.found },
    });
    return result;
  }

  @Post('admin/search/reindex')
  @UseGuards(AdminGuard)
  reindex() {
    return this.service.reindex();
  }
}
