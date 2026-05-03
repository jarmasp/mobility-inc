import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { DriverClient } from '../clients/driver.client';
import { PaymentsClient } from '../clients/payments.client';
import { NotificationsService } from '../notifications/notifications.service';
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
  private readonly logger = new Logger(RidersService.name);

  constructor(
    private readonly ridersRepository: RidersRepository,
    private readonly paymentsClient: PaymentsClient,
    private readonly driverClient: DriverClient,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(dto: CreateRiderDto, user: AuthenticatedUser) {
    const rider = await this.ridersRepository.create(dto, user.appUserId);
    this.notificationsService
      .sendWelcomeRider({
        email: rider.email,
        name: rider.name,
      })
      .catch((error) => {
        this.logger.warn(`Failed to send signup notification: ${String(error)}`);
      });
    return rider;
  }

  async findById(id: string) {
    const rider = await this.ridersRepository.findById(id);
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  async deposit(id: string, dto: DepositDto) {
    const rider = await this.findById(id);

    const transaction = await this.paymentsClient.createTransaction({
      type: 'DEPOSIT',
      senderId: id,
      receiverId: null,
      amount: dto.amount,
    });

    const balance = await this.ridersRepository.updateBalance(id, dto.amount);

    this.notificationsService
      .sendDepositConfirmed({
        email: rider.email,
        name: rider.name,
        amount: dto.amount,
        balance,
      })
      .catch((error) => {
        this.logger.warn(
          `Failed to send deposit notification: ${String(error)}`,
        );
      });

    return {
      transactionId: transaction.transactionId,
      balance,
    };
  }

  async pay(id: string, dto: PayDto) {
    const rider = await this.findById(id);
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

    await this.applyPaymentBalance(id, dto.amount);

    return {
      transactionId: transaction.transactionId,
      code: transaction.code,
      amount: transaction.amount,
    };
  }

  private async applyPaymentBalance(
    riderId: string,
    amount: number,
  ): Promise<number> {
    try {
      return await this.ridersRepository.updateBalance(riderId, -amount);
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
