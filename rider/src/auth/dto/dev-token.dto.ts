import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DevTokenDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  subject?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
