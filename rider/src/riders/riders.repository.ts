import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRiderDto } from './dto/create-rider.dto';
import { RiderEntity } from './entities/rider.entity';
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
  constructor(
    @InjectRepository(RiderEntity)
    private readonly riderRepository: Repository<RiderEntity>,
  ) {}

  async create(dto: CreateRiderDto, userId: string): Promise<Rider> {
    const rider = this.riderRepository.create({
      id: randomUUID().toLowerCase(),
      name: dto.name,
      email: dto.email,
      userId,
      balance: 1000,
      createdAt: new Date(),
    });

    const created = await this.riderRepository.save(rider);
    return this.toDomain(created);
  }

  async findById(id: string): Promise<Rider | undefined> {
    const rider = await this.riderRepository.findOneBy({ id });
    return rider ? this.toDomain(rider) : undefined;
  }

  async updateBalance(id: string, delta: number): Promise<number> {
    return this.riderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(RiderEntity);
      const rider = await repository.findOneBy({ id });

      if (!rider) {
        throw new RiderNotFoundError();
      }

      const nextBalance = rider.balance + delta;
      if (nextBalance < 0) {
        throw new InsufficientFundsError();
      }

      rider.balance = nextBalance;
      await repository.save(rider);
      return nextBalance;
    });
  }

  private toDomain(entity: RiderEntity): Rider {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email,
      balance: entity.balance,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
