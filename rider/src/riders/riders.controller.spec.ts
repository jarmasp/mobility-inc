import { Test, TestingModule } from '@nestjs/testing';
import { RidersController } from './riders.controller';
import { RidersService } from './riders.service';

describe('RidersController', () => {
  let controller: RidersController;
  let service: jest.Mocked<RidersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RidersController],
      providers: [
        {
          provide: RidersService,
          useValue: {
            register: jest.fn(),
            findById: jest.fn(),
            deposit: jest.fn(),
            pay: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RidersController>(RidersController);
    service = module.get(RidersService);
  });

  it('creates rider through service', async () => {
    service.register.mockResolvedValue({
      id: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
      name: 'Ava',
      email: 'ava@example.com',
      balance: 1000,
      createdAt: '2026-05-01T00:00:00.000Z',
    });

    await expect(
      controller.create(
        { name: 'Ava', email: 'ava@example.com' },
        {
          sub: 'dev:e2e-rider',
          appUserId: '3ae289e1-e2da-45d0-b2a9-5f0f2d4f4f98',
          role: 'rider',
        },
      ),
    ).resolves.toEqual({
        id: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        name: 'Ava',
        email: 'ava@example.com',
        balance: 1000,
        createdAt: '2026-05-01T00:00:00.000Z',
      });
  });

  it('gets rider by id through service', async () => {
    service.findById.mockResolvedValue({
      id: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
      name: 'Ava',
      email: 'ava@example.com',
      balance: 1000,
      createdAt: '2026-05-01T00:00:00.000Z',
    });

    await expect(
      controller.getById('1f7bf78a-cf6f-4051-b5f2-2828596a7db9'),
    ).resolves.toStrictEqual({
      id: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
      name: 'Ava',
      email: 'ava@example.com',
      balance: 1000,
      createdAt: '2026-05-01T00:00:00.000Z',
    });
  });
});
