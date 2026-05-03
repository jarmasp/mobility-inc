import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../auth.types';
import { AuthService } from '../auth.service';

interface JwtClaims {
  sub: string;
  app_user_id: string;
  role: 'rider';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authService.jwtSecret(),
    });
  }

  validate(payload: JwtClaims): AuthenticatedUser {
    return this.authService.fromJwtPayload(payload);
  }
}
