import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { AuthService, JwtPayload } from './auth.service';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload =>
    ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    if (!header.startsWith('Bearer ')) throw new UnauthorizedException('Please sign in');
    req.user = this.auth.verify(header.slice(7));
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
