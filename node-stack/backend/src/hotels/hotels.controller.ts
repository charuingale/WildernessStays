import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { HotelsService } from './hotels.service';
import { QueryHotelsDto } from './dto/query-hotels.dto';

@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  findAll(@Query() query: QueryHotelsDto) {
    return this.hotelsService.findAll(query);
  }

  @Get(':id/calendar')
  calendar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('start') start?: string,
    @Query('days') days?: string,
    @Query('roomId') roomId?: string,
  ) {
    return this.hotelsService.calendar(id, start, days ? parseInt(days, 10) : undefined, roomId || undefined);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('checkIn') checkIn?: string,
    @Query('checkOut') checkOut?: string,
  ) {
    return this.hotelsService.findOne(id, checkIn, checkOut);
  }
}
