import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { logger } from '@/config/logger';

export interface EmailSendOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class MailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS.replace(/\s+/g, ''),
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      return this.transporter;
    }

    return null;
  }

  async sendMail(options: EmailSendOptions): Promise<boolean> {
    const transporter = this.getTransporter();

    if (!transporter) {
      logger.info(
        {
          to: options.to,
          subject: options.subject,
        },
        '[MAIL CONSOLE ADAPTER] No SMTP credentials configured. Email logged to console.'
      );
      return true;
    }

    try {
      const fromAddress = env.SMTP_FROM || env.SMTP_USER;
      await transporter.sendMail({
        from: `"Aagara Thirupthi" <${fromAddress}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info({ to: options.to, subject: options.subject }, 'Email successfully dispatched');
      return true;
    } catch (err) {
      logger.error({ err, to: options.to }, 'Failed to dispatch email');
      return false;
    }
  }

  async sendOtpEmail(toEmail: string, otp: string, role = 'User'): Promise<boolean> {
    const subject = `${otp} is your Aagara Thirupthi verification code`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ea580c; margin: 0; font-size: 24px; font-weight: 700;">Aagara Thirupthi</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Hyper-local Event Services</p>
        </div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 24px;" />
        <p style="color: #1e293b; font-size: 16px; margin-bottom: 8px;">Hello,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
          Use the following One-Time Password (OTP) to securely sign in as <strong>${role}</strong>. This OTP is valid for <strong>5 minutes</strong>.
        </p>
        <div style="background-color: #fff7ed; border: 1px dashed #fdba74; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #ea580c;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.4; margin-bottom: 24px;">
          If you did not request this OTP, please ignore this email or reach out to our support team.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 16px;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          &copy; ${new Date().getFullYear()} Aagara Thirupthi. All rights reserved.
        </p>
      </div>
    `;

    const text = `Your Aagara Thirupthi OTP is ${otp}. Valid for 5 minutes. Do not share it with anyone.`;

    return this.sendMail({
      to: toEmail,
      subject,
      text,
      html,
    });
  }
}

export const mailService = new MailService();
