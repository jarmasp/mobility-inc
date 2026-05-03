import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock };
  let usersService: { findOrCreateByProviderSubject: jest.Mock };

  beforeEach(() => {
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    };
    usersService = {
      findOrCreateByProviderSubject: jest.fn().mockResolvedValue({
        id: '6d6f6fd6-b2b2-40f7-9c7c-c4f6a8d7f8f1',
      }),
    };
    service = new AuthService(
      jwtService as unknown as JwtService,
      usersService as unknown as UsersService,
    );
  });

  it('creates dev token with expected rider claims', async () => {
    await expect(
      service.createDevToken({
        subject: 'e2e-rider',
        email: 'ava@example.com',
        name: 'Ava',
      }),
    ).resolves.toEqual({
      accessToken: 'jwt-token',
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'dev:e2e-rider',
      app_user_id: '6d6f6fd6-b2b2-40f7-9c7c-c4f6a8d7f8f1',
      role: 'rider',
    });
  });
});
