import {
  InsufficientFundsError,
  RiderNotFoundError,
  RidersRepository,
} from './riders.repository';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { RiderEntity } from './entities/rider.entity';
import { CreateRidersTable1746192000000 } from '../migrations/1746192000000-create-riders-table';
import { CreateUsersAndLinkRiders1746195600000 } from '../migrations/1746195600000-create-users-and-link-riders';
import { UserEntity } from '../users/entities/user.entity';

describe('RidersRepository', () => {
  let repository: RidersRepository;
  let dataSource: DataSource;

  beforeEach(async () => {
    const db = newDb();
    db.public.registerFunction({
      name: 'current_database',
      returns: DataType.text,
      implementation: () => 'pg_mem',
    });
    db.public.registerFunction({
      name: 'version',
      returns: DataType.text,
      implementation: () => 'PostgreSQL 15.0',
    });

    dataSource = await db.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [RiderEntity, UserEntity],
      migrations: [
        CreateRidersTable1746192000000,
        CreateUsersAndLinkRiders1746195600000,
      ],
    });

    await dataSource.initialize();
    await dataSource.runMigrations();

    repository = new RidersRepository(dataSource.getRepository(RiderEntity));
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('creates a rider with initial balance', async () => {
    const userId = randomUUID().toLowerCase();
    await dataSource.getRepository(UserEntity).save({
      id: userId,
      provider: 'dev',
      providerSubject: `test:${userId}`,
      email: 'ava@example.com',
      name: 'Ava',
      createdAt: new Date(),
    });

    const rider = await repository.create({
      name: 'Ava',
      email: 'ava@example.com',
    }, userId);

    expect(rider.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(rider.balance).toBe(1000);
    expect(rider.createdAt).toMatch(/Z$/);
  });

  it('updates balance atomically', async () => {
    const userId = randomUUID().toLowerCase();
    await dataSource.getRepository(UserEntity).save({
      id: userId,
      provider: 'dev',
      providerSubject: `test:${userId}`,
      email: 'ava@example.com',
      name: 'Ava',
      createdAt: new Date(),
    });

    const rider = await repository.create({
      name: 'Ava',
      email: 'ava@example.com',
    }, userId);

    const nextBalance = await repository.updateBalance(rider.id, 50);

    expect(nextBalance).toBe(1050);
    const updatedRider = await repository.findById(rider.id);
    expect(updatedRider?.balance).toBe(1050);
  });

  it('throws on rider not found', async () => {
    await expect(repository.updateBalance(randomUUID(), 1)).rejects.toThrow(
      RiderNotFoundError,
    );
  });

  it('throws on negative resulting balance', async () => {
    const userId = randomUUID().toLowerCase();
    await dataSource.getRepository(UserEntity).save({
      id: userId,
      provider: 'dev',
      providerSubject: `test:${userId}`,
      email: 'ava@example.com',
      name: 'Ava',
      createdAt: new Date(),
    });

    const rider = await repository.create({
      name: 'Ava',
      email: 'ava@example.com',
    }, userId);

    await expect(repository.updateBalance(rider.id, -1001)).rejects.toThrow(
      InsufficientFundsError,
    );
  });
});
