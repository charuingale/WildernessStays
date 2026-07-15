import {
  Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { AuthGuard, AdminGuard, CurrentUser } from '../auth/auth.guard';
import type { JwtPayload } from '../auth/auth.service';

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /** Admin: every booking in the system. */
  @Get()
  @UseGuards(AdminGuard)
  findAll(@Query() query: QueryBookingsDto) {
    return this.bookingsService.findAll(query);
  }

  /** Signed-in guest: only their own bookings. */
  @Get('mine')
  findMine(@CurrentUser() user: JwtPayload, @Query() query: QueryBookingsDto) {
    return this.bookingsService.findAll({ ...query, userId: user.sub });
  }

  @Get('export/csv')
  @UseGuards(AdminGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@Query() query: QueryBookingsDto, @Res() res: Response) {
    const csv = await this.bookingsService.exportCsv(query);
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Get(':id/cancellation-quote')
  quote(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.quote(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.cancel(id, user);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.findOneOwned(id, user);
  }

  @Post()
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.create(dto, user.sub);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookingsService.update(id, dto, user);
  }

  /** Deleting booking records is an admin-only operation; guests cancel instead. */
  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.bookingsService.remove(id, user);
  }
}
