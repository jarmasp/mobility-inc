import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DriverClient } from '../clients/driver.client';
import { PaymentsClient } from '../clients/payments.client';
import { RidersRepository } from './riders.repository';
import { RidersService } from './riders.service';

describe('RidersService', () => {
  let service: RidersService;
  let repository: RidersRepository;
  let paymentsClient: { createTransaction: jest.Mock };
  let driverClient: { verifyExists: jest.Mock };

  beforeEach(() => {
    repository = new RidersRepository();
    paymentsClient = {
      createTransaction: jest.fn(),
    };
    driverClient = {
      verifyExists: jest.fn(),
    };

    service = new RidersService(
      repository,
      paymentsClient as unknown as PaymentsClient,
      driverClient as unknown as DriverClient,
    );
  });

  it('deposits funds and returns transaction response', async () => {
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
    paymentsClient.createTransaction.mockResolvedValue({
      transactionId: '5a7fd42a-cf2c-4450-b79c-4a7c420da53d',
    });

    const response = await service.deposit(rider.id, { amount: 50 });

    expect(response).toEqual({
      transactionId: '5a7fd42a-cf2c-4450-b79c-4a7c420da53d',
      balance: 1050,
    });
  });

  it('returns 404 when depositing for unknown rider', async () => {
    await expect(
      service.deposit('1f7bf78a-cf6f-4051-b5f2-2828596a7db9', { amount: 50 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 502 on deposit downstream failure', async () => {
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
    paymentsClient.createTransaction.mockRejectedValue(
      new BadGatewayException('Payments down'),
    );

    await expect(service.deposit(rider.id, { amount: 50 })).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('returns 400 on pay when insufficient funds', async () => {
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
    driverClient.verifyExists.mockResolvedValue(undefined);

    await expect(
      service.pay(rider.id, {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 1001,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns 404 on pay when rider missing', async () => {
    await expect(
      service.pay('850ce8f2-a0ad-4e2f-972a-14a1bfca70ee', {
        driverId: '4ecf9bf2-54d2-48bd-b947-41d77095d3fa',
        amount: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns 404 on pay when driver missing', async () => {
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
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
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
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
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
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
    const rider = service.register({ name: 'Ava', email: 'ava@example.com' });
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
