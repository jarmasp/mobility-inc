import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DriverClient } from './clients/driver.client';
import { PaymentsClient } from './clients/payments.client';
import { UserIdGuard } from './common/guards/user-id.guard';
import { HealthController } from './health/health.controller';
import { RidersController } from './riders/riders.controller';
import { RidersRepository } from './riders/riders.repository';
import { RidersService } from './riders/riders.service';

@Module({
  imports: [HttpModule],
  controllers: [RidersController, HealthController],
  providers: [
    RidersService,
    RidersRepository,
    PaymentsClient,
    DriverClient,
    UserIdGuard,
  ],
})
export class AppModule {}
