import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../auth/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateRiderDto } from './dto/create-rider.dto';
import { DepositDto } from './dto/deposit.dto';
import { PayDto } from './dto/pay.dto';
import { RidersService } from './riders.service';

@Controller('riders')
@UseGuards(JwtAuthGuard)
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRiderDto, @AuthUser() user: AuthenticatedUser) {
    return this.ridersService.register(dto, user);
  }

  @Get(':id')
  async getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ridersService.findById(id);
  }

  @Post(':id/deposit')
  @HttpCode(HttpStatus.OK)
  async deposit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DepositDto,
  ) {
    return this.ridersService.deposit(id, dto);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.CREATED)
  async pay(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: PayDto) {
    return this.ridersService.pay(id, dto);
  }
}
