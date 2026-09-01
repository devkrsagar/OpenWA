import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserAuthService } from './user-auth.service';
import { Public } from './decorators/auth.decorators';
import {
  SignupDto,
  VerifyOtpDto,
  ResendOtpDto,
  LoginUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/user-auth.dto';

@ApiTags('auth')
@Controller('auth')
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign up with email, name, and password (triggers OTP verification email)' })
  async signup(@Body() dto: SignupDto) {
    return this.userAuthService.signup(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email registration or login OTP code' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.userAuthService.verifyOtp(dto);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification OTP code' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.userAuthService.resendOtp(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginUserDto) {
    return this.userAuthService.login(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.userAuthService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.userAuthService.resetPassword(dto);
  }

  @Public()
  @Get('me')
  @ApiOperation({ summary: 'Get profile and subscription for authenticated JWT user or API key' })
  async getMe(
    @Headers('authorization') authHeader?: string,
    @Headers('x-api-key') xApiKey?: string,
  ) {
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (xApiKey) {
      token = xApiKey.trim();
    } else if (authHeader) {
      token = authHeader.trim();
    }

    if (!token) {
      return {
        id: 'guest',
        name: 'Guest User',
        email: 'guest@openwa.local',
        role: 'user',
        status: 'active',
      };
    }

    const decoded = this.userAuthService.verifyToken(token);
    if (decoded && decoded.sub) {
      try {
        return await this.userAuthService.getMe(decoded.sub);
      } catch {
        return {
          id: decoded.sub,
          name: decoded.name || decoded.email,
          email: decoded.email,
          role: decoded.role || 'user',
          status: 'active',
        };
      }
    }

    // Default admin mock profile when authenticated via raw API key
    return {
      id: 'admin',
      name: 'System Admin',
      email: 'admin@openwa.local',
      role: 'admin',
      status: 'active',
    };
  }
}
