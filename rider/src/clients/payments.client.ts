import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';

interface TransactionRequest {
  type: TransactionType;
  senderId: string;
  receiverId: string | null;
  amount: number;
  idempotencyKey?: string;
}

export interface PaymentsTransactionResponse {
  transactionId: string;
  type: TransactionType;
  status: 'COMPLETED';
  code: string | null;
  senderId: string;
  receiverId: string | null;
  amount: number;
  createdAt: string;
}

interface ErrorEnvelope {
  error?: string;
}

@Injectable()
export class PaymentsClient {
  private readonly baseUrl = process.env.PAYMENTS_URL ?? 'http://payments:8081';

  constructor(private readonly httpService: HttpService) {}

  async createTransaction(
    payload: TransactionRequest,
  ): Promise<PaymentsTransactionResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<PaymentsTransactionResponse>(
          `${this.baseUrl}/transactions`,
          {
            type: payload.type,
            senderId: payload.senderId,
            receiverId: payload.receiverId,
            amount: payload.amount,
          },
          {
            headers: payload.idempotencyKey
              ? {
                  'Idempotency-Key': payload.idempotencyKey,
                }
              : undefined,
          },
        ),
      );

      return response.data;
    } catch (error) {
      throw this.mapAxiosError(error);
    }
  }

  private mapAxiosError(error: unknown): Error {
    if (!(error instanceof AxiosError)) {
      return new BadGatewayException('Payments service unavailable');
    }

    const status = error.response?.status;
    const data = error.response?.data as ErrorEnvelope | undefined;
    const message = data?.error ?? 'Payments request failed';

    if (status === 400) {
      return new BadRequestException(message);
    }

    if (status === 422) {
      return new UnprocessableEntityException(message);
    }

    return new BadGatewayException(message);
  }
}
