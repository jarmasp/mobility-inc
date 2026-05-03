import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async findOrCreateByProviderSubject(params: {
    provider: string;
    providerSubject: string;
    email?: string;
    name?: string;
  }): Promise<UserEntity> {
    const existing = await this.usersRepository.findOneBy({
      provider: params.provider,
      providerSubject: params.providerSubject,
    });
    if (existing) {
      return existing;
    }

    const user = this.usersRepository.create({
      id: randomUUID().toLowerCase(),
      provider: params.provider,
      providerSubject: params.providerSubject,
      email: params.email ?? null,
      name: params.name ?? null,
      createdAt: new Date(),
    });
    return this.usersRepository.save(user);
  }
}
