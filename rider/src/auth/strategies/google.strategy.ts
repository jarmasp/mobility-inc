import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleAuthProfile } from '../auth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID ?? 'stub-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'stub-google-client-secret',
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ??
        'http://localhost:3000/auth/google/callback',
      scope: ['profile', 'email'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      displayName?: string;
      emails?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ): void {
    const user: GoogleAuthProfile = {
      subject: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
    };
    done(null, user);
  }
}
