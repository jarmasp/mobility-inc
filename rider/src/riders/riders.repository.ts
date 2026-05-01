import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { Rider } from './rider.types';

export class RiderNotFoundError extends Error {
  constructor() {
    super('Rider not found');
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super('Insufficient funds');
  }
}

@Injectable()
export class RidersRepository {
  private readonly riders = new Map<string, Rider>();

  create(dto: CreateRiderDto): Rider {
    const rider: Rider = {
      id: randomUUID().toLowerCase(),
      name: dto.name,
      email: dto.email,
      balance: 1000,
      createdAt: new Date().toISOString(),
    };

    this.riders.set(rider.id, rider);
    return rider;
  }

  findById(id: string): Rider | undefined {
    return this.riders.get(id);
  }

  updateBalance(id: string, delta: number): number {
    const rider = this.riders.get(id);

    if (!rider) {
      throw new RiderNotFoundError();
    }

    const nextBalance = rider.balance + delta;
    if (nextBalance < 0) {
      throw new InsufficientFundsError();
    }

    this.riders.set(id, {
      ...rider,
      balance: nextBalance,
    });

    return nextBalance;
  }
}
