import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriverClient } from '../clients/driver.client';
import { PaymentsClient } from '../clients/payments.client';
import { CreateRiderDto } from './dto/create-rider.dto';
import { DepositDto } from './dto/deposit.dto';
import { PayDto } from './dto/pay.dto';
import {
  InsufficientFundsError,
  RiderNotFoundError,
  RidersRepository,
} from './riders.repository';

@Injectable()
export class RidersService {
  constructor(
    private readonly ridersRepository: RidersRepository,
    private readonly paymentsClient: PaymentsClient,
    private readonly driverClient: DriverClient,
  ) {}

  register(dto: CreateRiderDto) {
    return this.ridersRepository.create(dto);
  }

  findById(id: string) {
    const rider = this.ridersRepository.findById(id);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  async deposit(id: string, dto: DepositDto) {
    this.findById(id);

    const transaction = await this.paymentsClient.createTransaction({
      type: 'DEPOSIT',
      senderId: id,
      receiverId: null,
      amount: dto.amount,
    });

    const balance = this.ridersRepository.updateBalance(id, dto.amount);

    return {
      transactionId: transaction.transactionId,
      balance,
    };
  }

  async pay(id: string, dto: PayDto) {
    const rider = this.findById(id);
    await this.driverClient.verifyExists(dto.driverId);

    if (rider.balance < dto.amount) {
      throw new BadRequestException('Insufficient funds');
    }

    const transaction = await this.paymentsClient.createTransaction({
      type: 'TRANSFER',
      senderId: id,
      receiverId: dto.driverId,
      amount: dto.amount,
    });

    this.applyPaymentBalance(id, dto.amount);

    return {
      transactionId: transaction.transactionId,
      code: transaction.code,
      amount: transaction.amount,
    };
  }

  private applyPaymentBalance(riderId: string, amount: number): number {
    try {
      return this.ridersRepository.updateBalance(riderId, -amount);
    } catch (error) {
      if (error instanceof RiderNotFoundError) {
        throw new NotFoundException('Rider not found');
      }

      if (error instanceof InsufficientFundsError) {
        throw new BadRequestException('Insufficient funds');
      }

      throw error;
    }
  }
}
