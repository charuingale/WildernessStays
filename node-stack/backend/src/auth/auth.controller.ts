import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import type { JwtPayload } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.name, dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return { id: user.sub, name: user.name, email: user.email, role: user.role };
  }
}
