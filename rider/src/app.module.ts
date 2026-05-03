import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { DriverClient } from './clients/driver.client';
import { PaymentsClient } from './clients/payments.client';
import { HealthController } from './health/health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { RiderEntity } from './riders/entities/rider.entity';
import { RidersController } from './riders/riders.controller';
import { RidersRepository } from './riders/riders.repository';
import { RidersService } from './riders/riders.service';
import { UserEntity } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
      migrationsRun: true,
      entities: [RiderEntity, UserEntity],
      migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
    }),
    TypeOrmModule.forFeature([RiderEntity, UserEntity]),
    AuthModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [RidersController, HealthController],
  providers: [
    RidersService,
    RidersRepository,
    PaymentsClient,
    DriverClient,
  ],
})
export class AppModule {}
