import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

interface ErrorEnvelope {
  error?: string;
}

@Injectable()
export class DriverClient {
  private readonly baseUrl = process.env.DRIVER_URL ?? 'http://driver:8080';

  constructor(private readonly httpService: HttpService) {}

  async verifyExists(driverId: string): Promise<void> {
    try {
      await firstValueFrom(this.httpService.get(`${this.baseUrl}/drivers/${driverId}`));
    } catch (error) {
      throw this.mapAxiosError(error);
    }
  }

  private mapAxiosError(error: unknown): Error {
    if (!(error instanceof AxiosError)) {
      return new BadGatewayException('Driver service unavailable');
    }

    const status = error.response?.status;
    const data = error.response?.data as ErrorEnvelope | undefined;

    if (status === 404) {
      return new NotFoundException(data?.error ?? 'Driver not found');
    }

    return new BadGatewayException(data?.error ?? 'Driver service unavailable');
  }
}
