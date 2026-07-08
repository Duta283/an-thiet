import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUserId } from '../../common/auth.guard';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto';

@Controller()
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Get('restaurants/:id/contents')
  listByRestaurant(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listByRestaurant(id);
  }

  @Post('contents')
  @UseGuards(AuthGuard)
  create(@CurrentUserId() userId: string, @Body() dto: CreateContentDto) {
    return this.service.create(userId, dto);
  }

  @Post('contents/:id/report')
  @UseGuards(AuthGuard)
  report(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.report(id);
  }
}
