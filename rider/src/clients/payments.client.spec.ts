import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PaymentsClient } from './payments.client';

jest.mock('@grpc/proto-loader', () => ({
  loadSync: jest.fn(),
}));

describe('PaymentsClient', () => {
  let client: PaymentsClient;
  let createTransactionMock: jest.Mock;

  beforeEach(() => {
    process.env.PAYMENTS_GRPC_URL = 'payments.test:50051';
    createTransactionMock = jest.fn();
    jest.spyOn(grpc, 'loadPackageDefinition').mockReturnValue({
      payments: {
        v1: {
          PaymentsService: jest.fn().mockImplementation(() => ({
            CreateTransaction: createTransactionMock,
          })),
        },
      },
    } as unknown as grpc.GrpcObject);
    (protoLoader.loadSync as jest.Mock).mockReturnValue({});
    client = new PaymentsClient();
  });

  afterEach(() => {
    delete process.env.PAYMENTS_GRPC_URL;
    jest.restoreAllMocks();
  });

  it('returns mapped response for successful requests', async () => {
    createTransactionMock.mockImplementation((_payload, callback) => {
      callback(null, {
        transaction_id: '2d31d86f-9a42-4b2a-b549-a9546f5d28d8',
        type: 'DEPOSIT',
        status: 'COMPLETED',
        code: '',
        sender_id: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiver_id: '',
        amount: '10.00',
        created_at: '2026-05-01T00:00:00.000Z',
      });
    });

    await expect(
      client.createTransaction({
        type: 'DEPOSIT',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
      }),
    ).resolves.toEqual({
      transactionId: '2d31d86f-9a42-4b2a-b549-a9546f5d28d8',
      type: 'DEPOSIT',
      status: 'COMPLETED',
      code: null,
      senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
      receiverId: null,
      amount: 10,
      createdAt: '2026-05-01T00:00:00.000Z',
    });
  });

  it('maps INVALID_ARGUMENT to BadRequestException', async () => {
    createTransactionMock.mockImplementation((_payload, callback) => {
      callback({
        code: grpc.status.INVALID_ARGUMENT,
        details: 'Invalid amount',
      });
    });

    await expect(
      client.createTransaction({
        type: 'DEPOSIT',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps FAILED_PRECONDITION to UnprocessableEntityException', async () => {
    createTransactionMock.mockImplementation((_payload, callback) => {
      callback({
        code: grpc.status.FAILED_PRECONDITION,
        details: 'Self transfer is not allowed',
      });
    });

    await expect(
      client.createTransaction({
        type: 'TRANSFER',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        amount: 10,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('maps NOT_FOUND to NotFoundException', async () => {
    createTransactionMock.mockImplementation((_payload, callback) => {
      callback({
        code: grpc.status.NOT_FOUND,
        details: 'Transaction not found',
      });
    });

    await expect(
      client.createTransaction({
        type: 'DEPOSIT',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('maps internal errors to BadGatewayException', async () => {
    createTransactionMock.mockImplementation((_payload, callback) => {
      callback({
        code: grpc.status.INTERNAL,
        details: 'Payments down',
      });
    });

    await expect(
      client.createTransaction({
        type: 'DEPOSIT',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
      }),
    ).rejects.toThrow(BadGatewayException);
  });
});
