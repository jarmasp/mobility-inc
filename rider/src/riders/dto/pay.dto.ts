import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class PayDto {
  @IsUUID()
  driverId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
