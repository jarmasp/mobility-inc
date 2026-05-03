import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DriverClient } from '../src/clients/driver.client';
import { PaymentsClient } from '../src/clients/payments.client';
import { ErrorEnvelopeFilter } from '../src/common/filters/error-envelope.filter';

describe('Riders API (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';

  const paymentsClientStub = {
    createTransaction: jest.fn().mockImplementation((payload) => {
      if (payload.type === 'DEPOSIT') {
        return Promise.resolve({
          transactionId: 'b95f6fce-c99d-46c9-9158-a5775d755f61',
          type: 'DEPOSIT',
          status: 'COMPLETED',
          code: null,
          senderId: payload.senderId,
          receiverId: null,
          amount: payload.amount,
          createdAt: '2026-05-01T00:00:00.000Z',
        });
      }

      return Promise.resolve({
        transactionId: 'a4be7b93-5265-4e49-ab6e-b159f8b64f89',
        type: 'TRANSFER',
        status: 'COMPLETED',
        code: 'AAAA0000',
        senderId: payload.senderId,
        receiverId: payload.receiverId,
        amount: payload.amount,
        createdAt: '2026-05-01T00:00:00.000Z',
      });
    }),
  };

  const driverClientStub = {
    verifyExists: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    process.env.AUTH_STUB = 'true';
    process.env.JWT_SECRET = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PaymentsClient)
      .useValue(paymentsClientStub)
      .overrideProvider(DriverClient)
      .useValue(driverClientStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ErrorEnvelopeFilter());
    await app.init();

    const tokenResponse = await request(app.getHttpServer())
      .post('/auth/dev/token')
      .send({
        subject: 'e2e-rider',
        email: 'ava@example.com',
        name: 'Ava',
      })
      .expect(200);

    accessToken = tokenResponse.body.accessToken;
  });

  afterEach(async () => {
    delete process.env.AUTH_STUB;
    delete process.env.JWT_SECRET;
    await app.close();
  });

  it('supports register, get, deposit, and pay happy path', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/riders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Ava',
        email: 'ava@example.com',
      })
      .expect(201);

    expect(createResponse.body.balance).toBe(1000);

    await request(app.getHttpServer())
      .get(`/riders/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/riders/${createResponse.body.id}/deposit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: 50 })
      .expect(200)
      .expect({
        transactionId: 'b95f6fce-c99d-46c9-9158-a5775d755f61',
        balance: 1050,
      });

    await request(app.getHttpServer())
      .post(`/riders/${createResponse.body.id}/pay`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        driverId: 'bc489953-abf6-47f8-9c96-97fd4e5e96cf',
        amount: 25,
      })
      .expect(201)
      .expect({
        transactionId: 'a4be7b93-5265-4e49-ab6e-b159f8b64f89',
        code: 'AAAA0000',
        amount: 25,
      });
  });

  it('rejects rider endpoints without bearer token', async () => {
    await request(app.getHttpServer())
      .post('/riders')
      .send({
        name: 'No Auth',
        email: 'no-auth@example.com',
      })
      .expect(401);
  });
});
