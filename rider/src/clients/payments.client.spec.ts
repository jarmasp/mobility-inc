import {
  BadGatewayException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { PaymentsClient } from './payments.client';

describe('PaymentsClient', () => {
  let client: PaymentsClient;
  let httpService: { post: jest.Mock };

  beforeEach(() => {
    process.env.PAYMENTS_URL = 'http://payments.test:8081';
    httpService = { post: jest.fn() };
    client = new PaymentsClient(httpService as unknown as HttpService);
  });

  afterEach(() => {
    delete process.env.PAYMENTS_URL;
  });

  it('returns response body for successful requests', async () => {
    const response: AxiosResponse = {
      data: {
        transactionId: '2d31d86f-9a42-4b2a-b549-a9546f5d28d8',
        type: 'DEPOSIT',
        status: 'COMPLETED',
        code: null,
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      status: 201,
      statusText: 'Created',
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    };
    httpService.post.mockReturnValue(of(response));

    await expect(
      client.createTransaction({
        type: 'DEPOSIT',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
      }),
    ).resolves.toEqual(response.data);
  });

  it('maps 400 responses to BadRequestException', async () => {
    httpService.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Bad Request',
            '400',
            undefined,
            undefined,
            createErrorResponse(400, { error: 'Invalid amount' }),
          ),
      ),
    );

    await expect(
      client.createTransaction({
        type: 'DEPOSIT',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: null,
        amount: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps 422 responses to UnprocessableEntityException', async () => {
    httpService.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Unprocessable Entity',
            '422',
            undefined,
            undefined,
            createErrorResponse(422, { error: 'Self transfer is not allowed' }),
          ),
      ),
    );

    await expect(
      client.createTransaction({
        type: 'TRANSFER',
        senderId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        receiverId: '1f7bf78a-cf6f-4051-b5f2-2828596a7db9',
        amount: 10,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('maps 5xx responses to BadGatewayException', async () => {
    httpService.post.mockReturnValue(
      throwError(
        () =>
          new AxiosError(
            'Server Error',
            '500',
            undefined,
            undefined,
            createErrorResponse(500, { error: 'Payments down' }),
          ),
      ),
    );

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

function createErrorResponse(status: number, data: { error: string }): AxiosResponse {
  return {
    data,
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  };
}
