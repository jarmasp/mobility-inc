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
import { UserIdGuard } from '../common/guards/user-id.guard';
import { CreateRiderDto } from './dto/create-rider.dto';
import { DepositDto } from './dto/deposit.dto';
import { PayDto } from './dto/pay.dto';
import { RidersService } from './riders.service';

@Controller('riders')
@UseGuards(UserIdGuard)
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRiderDto) {
    return this.ridersService.register(dto);
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.ridersService.findById(id);
  }

  @Post(':id/deposit')
  @HttpCode(HttpStatus.OK)
  deposit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DepositDto,
  ) {
    return this.ridersService.deposit(id, dto);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.CREATED)
  pay(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: PayDto) {
    return this.ridersService.pay(id, dto);
  }
}
