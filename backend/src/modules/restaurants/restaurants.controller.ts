import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/admin.guard';
import { CreateRestaurantDto, ListRestaurantsQuery } from './dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly service: RestaurantsService) {}

  /** Danh sách/bản đồ: ?lat=&lng=&radius=&area=&cuisine=&priceMax= */
  @Get()
  list(@Query() q: ListRestaurantsQuery) {
    return this.service.list(q);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  /** Tạo quán đơn lẻ — chỉ admin (seed hàng loạt dùng /admin/seed) */
  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateRestaurantDto) {
    return this.service.create(dto);
  }
}
