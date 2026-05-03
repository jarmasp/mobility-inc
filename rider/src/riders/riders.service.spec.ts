import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DriverClient } from '../clients/driver.client';
import { PaymentsClient } from '../clients/payments.client';
import { NotificationsService } from '../notifications/notifications.service';
import { Rider } from './rider.types';
import { RidersRepository } from './riders.repository';
import { RidersService } from './riders.service';

describe('RidersService', () => {
  let service: RidersService;
  let repository: jest.Mocked<RidersRepository>;
  let paymentsClient: { createTransaction: jest.Mock };
  let driverClient: { verifyExists: jest.Mock };
  let notificationsService: {
    sendWelcomeRider: jest.Mock;
    sendDepositConfirmed: jest.Mock;
  };
  const authUser = {
    sub: 'dev:e2e-rider',
    appUserId: 'd2f59f40-398c-4f44-a57e-5c57be7e9e6a',
    role: 'rider' as const,
  };
  const rider: Rider = {
    id: '850ce8f2-a0ad-4e2f-972a-14a1bfca70ee',
    name: 'Ava',
    email: 'ava@example.com',
    balance: 1000,
    createdAt: '2026-05-01T00:00:00.000Z',
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateBalance: jest.fn(),
    } as unknown as jest.Mocked<RidersRepository>;
    paymentsClient = {
      createTransaction: jest.fn(),
    };
    driverClient = {
      verifyExists: jest.fn(),
    };
    notificationsService = {
      sendWelcomeRider: jest.fn().mockResolvedValue(undefined),
      sendDepositConfirmed: jest.fn().mockResolvedValue(undefined),
    };

    service = new RidersService(
      repository,
      paymentsClient as unknown as PaymentsClient,
      driverClient as unknown as DriverClient,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('registers rider and sends welcome notification', async () => {
    repository.create.mockResolvedValue(rider);

    await expect(
      service.register({ name: rider.name, email: rider.email }, authUser),
    ).resolves.toEqual(rider);

    expect(repository.create).toHaveBeenCalledWith(
      { name: rider.name, email: rider.email },
      authUser.appUserId,
    );
    expect(notificationsService.sendWelcomeRider).toHaveBeenCalledWith({
      email: rider.email,
      name: rider.name,
    });
  });

  it('deposits funds and returns transaction response', async () => {
    repository.findById.mockResolvedValue(rider);
    repository.updateBalance.mockResolvedValue(1050);
    paymentsClient.createTransaction.mockResolvedValue({
      transactionId: '5a7fd42a-cf2c-4450-b79c-4a7c420da53d',
    });

    const response = await service.deposit(rider.id, { amount: 50 });

    expect(response).toEqual({
      transactionId: '5a7fd42a-cf2c-4450-b79c-4a7c420da53d',
      balance: 1050,
    });
    expect(notificationsService.sendDepositConfirmed).toHaveBeenCalledWith({
      email: rider.email,
      name: rider.name,
      amount: 50,
      balance: 1050,
    });
  });

  it('returns 404 when depositing for unknown rider', async () => {
    repository.findById.mockResolvedValue(undefined);

    await expect(
      service.deposit('1f7bf78a-cf6f-4051-b5f2-2828596a7db9', { amount: 50 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 502 on deposit downstream failure', async () => {
    repository.findById.mockResolvedValue(rider);
    paymentsClient.createTransaction.mockRejectedValue(
      new BadGatewayException('Payments down'),
    );

    await expect(service.deposit(rider.id, { amount: 50 })).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('returns 400 on pay when insufficient funds', async () => {
    repository.findById.mockResolvedValue(rider);
    driverClient.verifyExists.mockResolvedValue(undefined);

    await expect(
      service.pay(rider.id, {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 1001,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 on pay when rider missing', async () => {
    repository.findById.mockResolvedValue(undefined);

    await expect(
      service.pay('850ce8f2-a0ad-4e2f-972a-14a1bfca70ee', {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 404 on pay when driver missing', async () => {
    repository.findById.mockResolvedValue(rider);
    driverClient.verifyExists.mockRejectedValue(
      new NotFoundException('Driver not found'),
    );

    await expect(
      service.pay(rider.id, {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 422 on pay when payments rejects transfer', async () => {
    repository.findById.mockResolvedValue(rider);
    driverClient.verifyExists.mockResolvedValue(undefined);
    paymentsClient.createTransaction.mockRejectedValue(
      new UnprocessableEntityException('Self transfer is not allowed'),
    );

    await expect(
      service.pay(rider.id, {
        driverId: rider.id,
        amount: 10,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('returns 502 on pay downstream failure', async () => {
    repository.findById.mockResolvedValue(rider);
    driverClient.verifyExists.mockResolvedValue(undefined);
    paymentsClient.createTransaction.mockRejectedValue(
      new BadGatewayException('Payments down'),
    );

    await expect(
      service.pay(rider.id, {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 10,
      }),
    ).rejects.toThrow(BadGatewayException);
  });

  it('returns 201 pay payload on success', async () => {
    repository.findById.mockResolvedValue(rider);
    repository.updateBalance.mockResolvedValue(990);
    driverClient.verifyExists.mockResolvedValue(undefined);
    paymentsClient.createTransaction.mockResolvedValue({
      transactionId: '2d31d86f-9a42-4b2a-b549-a9546f5d28d8',
      amount: 10,
      code: 'ABCD1234',
    });

    await expect(
      service.pay(rider.id, {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 10,
      }),
    ).resolves.toEqual({
      transactionId: '2d31d86f-9a42-4b2a-b549-a9546f5d28d8',
      code: 'ABCD1234',
      amount: 10,
    });
  });
});
