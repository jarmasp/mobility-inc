import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser, GoogleAuthProfile } from './auth.types';
import { UsersService } from '../users/users.service';

interface JwtClaims {
  sub: string;
  app_user_id: string;
  role: 'rider';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  isAuthStubEnabled(): boolean {
    return process.env.AUTH_STUB === 'true';
  }

  async createDevToken(input: {
    subject: string;
    email?: string;
    name?: string;
  }): Promise<{ accessToken: string }> {
    const user = await this.usersService.findOrCreateByProviderSubject({
      provider: 'dev',
      providerSubject: input.subject,
      email: input.email,
      name: input.name,
    });

    return {
      accessToken: this.jwtService.sign(this.buildClaims(`dev:${input.subject}`, user.id)),
    };
  }

  async createGoogleToken(profile: GoogleAuthProfile): Promise<{ accessToken: string }> {
    const user = await this.usersService.findOrCreateByProviderSubject({
      provider: 'google',
      providerSubject: profile.subject,
      email: profile.email,
      name: profile.name,
    });

    return {
      accessToken: this.jwtService.sign(
        this.buildClaims(`google:${profile.subject}`, user.id),
      ),
    };
  }

  fromJwtPayload(payload: JwtClaims): AuthenticatedUser {
    if (!payload?.sub || !payload?.app_user_id || payload?.role !== 'rider') {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      sub: payload.sub,
      appUserId: payload.app_user_id,
      role: 'rider',
    };
  }

  jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET must be configured');
    }
    return secret;
  }

  private buildClaims(sub: string, appUserId: string): JwtClaims {
    return {
      sub,
      app_user_id: appUserId,
      role: 'rider',
    };
  }
}
