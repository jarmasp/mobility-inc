import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

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

interface GrpcTransactionResponse {
  transaction_id: string;
  type: TransactionType;
  status: 'COMPLETED';
  code: string;
  sender_id: string;
  receiver_id: string;
  amount: string;
  created_at: string;
}

interface CreateTransactionRequestMessage {
  type: TransactionType;
  sender_id: string;
  receiver_id: string;
  amount: string;
  idempotency_key: string;
}

interface PaymentsServiceClient {
  CreateTransaction(
    request: CreateTransactionRequestMessage,
    callback: (
      error: grpc.ServiceError | null,
      response: GrpcTransactionResponse,
    ) => void,
  ): void;
}

interface GrpcPackage {
  payments: {
    v1: {
      PaymentsService: new (
        address: string,
        credentials: grpc.ChannelCredentials,
      ) => PaymentsServiceClient;
    };
  };
}

@Injectable()
export class PaymentsClient {
  private readonly client: PaymentsServiceClient;

  constructor() {
    const packageDefinition = protoLoader.loadSync(
      path.join(__dirname, 'proto', 'payments.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );
    const grpcPackage = grpc.loadPackageDefinition(
      packageDefinition,
    ) as unknown as GrpcPackage;
    const target = process.env.PAYMENTS_GRPC_URL ?? 'payments:50051';
    this.client = new grpcPackage.payments.v1.PaymentsService(
      target,
      grpc.credentials.createInsecure(),
    );
  }

  async createTransaction(
    payload: TransactionRequest,
  ): Promise<PaymentsTransactionResponse> {
    try {
      const response = await this.createTransactionGrpc({
        type: payload.type,
        sender_id: payload.senderId,
        receiver_id: payload.receiverId ?? '',
        amount: payload.amount.toFixed(2),
        idempotency_key: payload.idempotencyKey ?? '',
      });
      return {
        transactionId: response.transaction_id,
        type: response.type,
        status: response.status,
        code: response.code || null,
        senderId: response.sender_id,
        receiverId: response.receiver_id || null,
        amount: Number(response.amount),
        createdAt: response.created_at,
      };
    } catch (error) {
      throw this.mapGrpcError(error);
    }
  }

  private createTransactionGrpc(
    payload: CreateTransactionRequestMessage,
  ): Promise<GrpcTransactionResponse> {
    return new Promise((resolve, reject) => {
      this.client.CreateTransaction(payload, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  private mapGrpcError(error: unknown): Error {
    if (!this.isGrpcError(error)) {
      return new BadGatewayException('Payments service unavailable');
    }

    if (error.code === grpc.status.INVALID_ARGUMENT) {
      return new BadRequestException(error.details || 'Payments request failed');
    }

    if (error.code === grpc.status.FAILED_PRECONDITION) {
      return new UnprocessableEntityException(
        error.details || 'Payments request failed',
      );
    }

    if (error.code === grpc.status.NOT_FOUND) {
      return new NotFoundException(error.details || 'Transaction not found');
    }

    return new BadGatewayException(error.details || 'Payments service unavailable');
  }

  private isGrpcError(error: unknown): error is grpc.ServiceError {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
