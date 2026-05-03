import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { DevTokenDto } from './dto/dev-token.dto';
import { AuthService } from './auth.service';
import { GoogleAuthProfile } from './auth.types';

interface RequestWithGoogleUser extends Request {
  user: GoogleAuthProfile;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() request: RequestWithGoogleUser) {
    return this.authService.createGoogleToken(request.user);
  }

  @Post('dev/token')
  @HttpCode(HttpStatus.OK)
  async issueDevToken(@Body() dto: DevTokenDto) {
    if (!this.authService.isAuthStubEnabled()) {
      throw new NotFoundException('Route not found');
    }

    const subject = dto.subject ?? 'e2e-rider';
    return this.authService.createDevToken({
      subject,
      email: dto.email,
      name: dto.name,
    });
  }
}
