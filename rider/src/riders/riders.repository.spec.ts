import {
  InsufficientFundsError,
  RiderNotFoundError,
  RidersRepository,
} from './riders.repository';
import { randomUUID } from 'crypto';

describe('RidersRepository', () => {
  let repository: RidersRepository;

  beforeEach(() => {
    repository = new RidersRepository();
  });

  it('creates a rider with initial balance', () => {
    const rider = repository.create({
      name: 'Ava',
      email: 'ava@example.com',
    });

    expect(rider.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(rider.balance).toBe(1000);
    expect(rider.createdAt).toMatch(/Z$/);
  });

  it('updates balance atomically', () => {
    const rider = repository.create({
      name: 'Ava',
      email: 'ava@example.com',
    });

    const nextBalance = repository.updateBalance(rider.id, 50);

    expect(nextBalance).toBe(1050);
    expect(repository.findById(rider.id)?.balance).toBe(1050);
  });

  it('throws on rider not found', () => {
    expect(() => repository.updateBalance(randomUUID(), 1)).toThrow(
      RiderNotFoundError,
    );
  });

  it('throws on negative resulting balance', () => {
    const rider = repository.create({
      name: 'Ava',
      email: 'ava@example.com',
    });

    expect(() => repository.updateBalance(rider.id, -1001)).toThrow(
      InsufficientFundsError,
    );
  });
});
