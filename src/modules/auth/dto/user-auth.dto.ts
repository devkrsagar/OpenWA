import { IsString, IsEmail, MinLength, MaxLength, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpType } from '../entities/otp.entity';

export class SignupDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  otpCode!: string;

  @ApiPropertyOptional({ enum: OtpType, default: OtpType.SIGNUP })
  @IsOptional()
  @IsEnum(OtpType)
  type?: OtpType;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ enum: OtpType, default: OtpType.SIGNUP })
  @IsOptional()
  @IsEnum(OtpType)
  type?: OtpType;
}

export class LoginUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  otpCode!: string;

  @ApiProperty({ example: 'NewStrongP@ssw0rd!' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword!: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ example: 'active', enum: ['active', 'suspended'] })
  @IsString()
  @IsNotEmpty()
  status!: 'active' | 'suspended';
}

export class UpdateUserPlanDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiPropertyOptional({ example: 'yearly', enum: ['monthly', 'yearly'] })
  @IsOptional()
  @IsString()
  billingCycle?: 'monthly' | 'yearly';
}
