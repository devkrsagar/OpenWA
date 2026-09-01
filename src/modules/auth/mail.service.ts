import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('smtp.host') || this.configService.get<string>('SMTP_HOST') || process.env.SMTP_HOST || 'openwa.webimaticsolutions.online';
    const port = parseInt(this.configService.get<string>('smtp.port') || this.configService.get<string>('SMTP_PORT') || process.env.SMTP_PORT || '587', 10);
    const user = this.configService.get<string>('smtp.user') || this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER || 'support@openwa.webimaticsolutions.online';
    const pass = this.configService.get<string>('smtp.pass') || this.configService.get<string>('SMTP_PASS') || process.env.SMTP_PASS || 'gSEwpVrf';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.logger.log(`Mail service initialized with SMTP host: ${host}:${port} (user: ${user})`);
    } else {
      // Local fallback
      try {
        this.transporter = nodemailer.createTransport({
          host: '127.0.0.1',
          port: 25,
          tls: { rejectUnauthorized: false },
        });
      } catch (err) {
        this.logger.warn(`Could not bind default local mailer: ${err}`);
      }
    }
  }

  async sendOtpEmail(to: string, otpCode: string, type: 'signup' | 'password_reset' = 'signup'): Promise<boolean> {
    const from =
      process.env.SMTP_FROM ||
      this.configService.get<string>('smtp.from') ||
      '"WebiMatic Solutions" <support@openwa.webimaticsolutions.online>';
    const subject =
      type === 'signup'
        ? 'Your Verification Code - WebiMatic Solutions'
        : 'Password Reset Code - WebiMatic Solutions';

    const actionText =
      type === 'signup'
        ? 'verify your account registration'
        : 'reset your account password';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
        <h2 style="color: #22c55e; margin-top: 0; text-align: center;">WebiMatic Solutions</h2>
        <div style="background: #1e293b; padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="font-size: 15px; color: #cbd5e1; margin-bottom: 20px;">Use the verification code below to ${actionText}:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #22c55e; padding: 12px; background: #0f172a; border-radius: 6px; display: inline-block;">
            ${otpCode}
          </div>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
        <p style="font-size: 12px; color: #64748b; text-align: center;">© ${new Date().getFullYear()} WebiMatic Solutions. All rights reserved.</p>
      </div>
    `;

    // Always log OTP for development and server observability
    this.logger.log(`[OTP Verification] Generated code for ${to}: [ ${otpCode} ] (Type: ${type})`);

    if (!this.transporter) {
      return true;
    }

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      this.logger.log(`Successfully sent OTP email to ${to}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to dispatch SMTP email to ${to}: ${(error as Error).message}. (OTP printed in server logs).`);
      return true; // Still return true so user can verify if inspecting console/logs
    }
  }
}
