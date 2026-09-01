import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { OtpVerification, OtpType } from './entities/otp.entity';
import { MailService } from './mail.service';
import { BillingService } from '../billing/billing.service';
import {
  SignupDto,
  VerifyOtpDto,
  ResendOtpDto,
  LoginUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/user-auth.dto';

const JWT_SECRET = process.env.JWT_SECRET || 'webimatic-openwa-jwt-secret-key-2026';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  constructor(
    @InjectRepository(User, 'main')
    private readonly userRepo: Repository<User>,
    @InjectRepository(OtpVerification, 'main')
    private readonly otpRepo: Repository<OtpVerification>,
    private readonly mailService: MailService,
    private readonly billingService: BillingService,
  ) {}

  private generate6DigitOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private createToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  }

  async signup(dto: SignupDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    if (existing && existing.isEmailVerified) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let user = existing;

    if (!user) {
      user = this.userRepo.create({
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        role: UserRole.USER,
        isEmailVerified: false,
        status: UserStatus.ACTIVE,
      });
      user = await this.userRepo.save(user);
      // Create initial free subscription
      await this.billingService.createDefaultSubscriptionForUser(user);
    } else {
      user.name = dto.name.trim();
      user.passwordHash = passwordHash;
      await this.userRepo.save(user);
    }

    // Generate & send OTP
    const otpCode = this.generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate prior OTPs
    await this.otpRepo.delete({ email: user.email, type: OtpType.SIGNUP });

    const otpEntity = this.otpRepo.create({
      email: user.email,
      codeHash: this.hashData(otpCode),
      type: OtpType.SIGNUP,
      expiresAt,
    });
    await this.otpRepo.save(otpEntity);

    await this.mailService.sendOtpEmail(user.email, otpCode, 'signup');

    return {
      message: 'Signup successful. Please verify the 6-digit code sent to your email.',
      email: user.email,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const type = dto.type || OtpType.SIGNUP;

    const otpRecord = await this.otpRepo.findOne({
      where: { email, type },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No pending verification code found.');
    }

    if (new Date() > otpRecord.expiresAt) {
      await this.otpRepo.remove(otpRecord);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (otpRecord.codeHash !== this.hashData(dto.otpCode)) {
      otpRecord.attempts += 1;
      await this.otpRepo.save(otpRecord);
      if (otpRecord.attempts >= 5) {
        await this.otpRepo.remove(otpRecord);
        throw new BadRequestException('Too many invalid attempts. Please request a new code.');
      }
      throw new BadRequestException('Invalid verification code.');
    }

    // Code is valid
    await this.otpRepo.remove(otpRecord);

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    user.isEmailVerified = true;
    await this.userRepo.save(user);

    const token = this.createToken(user);
    const subscription = await this.billingService.getUserSubscription(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        subscription,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const type = dto.type || OtpType.SIGNUP;

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const otpCode = this.generate6DigitOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.otpRepo.delete({ email, type });
    const otpEntity = this.otpRepo.create({
      email,
      codeHash: this.hashData(otpCode),
      type,
      expiresAt,
    });
    await this.otpRepo.save(otpEntity);

    await this.mailService.sendOtpEmail(email, otpCode, type === OtpType.PASSWORD_RESET ? 'password_reset' : 'signup');

    return { message: 'A new verification code has been sent to your email.' };
  }

  async login(dto: LoginUserDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account is suspended. Please contact support.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isEmailVerified) {
      // Trigger new OTP
      await this.resendOtp({ email, type: OtpType.SIGNUP });
      return {
        requiresVerification: true,
        email: user.email,
        message: 'Account not verified. A verification code has been sent to your email.',
      };
    }

    const token = this.createToken(user);
    const subscription = await this.billingService.getUserSubscription(user.id);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        subscription,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userRepo.findOne({ where: { email } });
    if (user) {
      await this.resendOtp({ email, type: OtpType.PASSWORD_RESET });
    }
    return { message: 'If an account exists with this email, a reset code was dispatched.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const otpRecord = await this.otpRepo.findOne({
      where: { email, type: OtpType.PASSWORD_RESET },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord || otpRecord.codeHash !== this.hashData(dto.otpCode) || new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('Invalid or expired password reset code.');
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
    await this.otpRepo.remove(otpRecord);

    return { message: 'Password reset successfully. You can now login with your new password.' };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const subscription = await this.billingService.getUserSubscription(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      subscription,
    };
  }

  // Admin User Management
  async getAllUsers(): Promise<any[]> {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return Promise.all(
      users.map(async u => {
        const sub = await this.billingService.getUserSubscription(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isEmailVerified: u.isEmailVerified,
          status: u.status,
          subscription: sub,
          createdAt: u.createdAt,
        };
      }),
    );
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.status = status;
    return this.userRepo.save(user);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.remove(user);
  }
}
