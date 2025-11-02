import { htmlToText } from 'html-to-text';
import nodemailer from 'nodemailer';
import { AppError } from '../utils/AppError.js';

interface EmailOptions {
  email: string;
  subject: string;
  html: string;
  text?: string;
}

export class Email {
  private to: string;
  private from: string;
  private subject: string;
  private html: string;
  private text: string;

  constructor(userEmail: string, options: Omit<EmailOptions, 'email'>) {
    this.to = userEmail;
    this.from = `"${process.env['EMAIL_FROM_NAME']}" <${process.env['EMAIL_FROM']}>`;
    this.subject = options.subject;
    this.html = options.html;
    this.text = options.text || htmlToText(options.html, { wordwrap: 130 });
  }

  private createTransport() {
    if (process.env['NODE_ENV'] === 'development') {
      // Nodemailer Ethereal (للتطوير فقط)
      return nodemailer.createTransport({
        host: process.env['EMAIL_HOST'],
        port: Number(process.env['EMAIL_PORT']),
        auth: {
          user: process.env['EMAIL_USER'],
          pass: process.env['EMAIL_PASS'],
        },
      });
    }

    // Production: SendGrid via SMTP
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env['SENDGRID_API_KEY'],
      },
    });
  }

  private async sendMail() {
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject: this.subject,
      text: this.text,
      html: this.html,
    };

    try {
      const info = await this.createTransport().sendMail(mailOptions);
      if (process.env['NODE_ENV'] === 'development') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }
      return info;
    } catch (error) {
      console.error('Email send failed:', error);
      throw new AppError('Failed to send email', 500);
    }
  }

  // === Templates ===
  async sendPasswordReset(resetUrl: string) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested a password reset. Click below to proceed:</p>
        <a href="${resetUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #10b981;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        ">Reset Password</a>
        <p style="margin-top: 20px; color: #666;">
          If you didn't request this, ignore this email.
        </p>
        <small style="color: #999;">Link expires in 10 minutes.</small>
      </div>
    `;

    this.html = html;
    this.subject = 'Password Reset Request';
    await this.sendMail();
  }

  async sendWelcome(name: string) {
    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome, ${name}!</h2>
        <p>We're excited to have you on board at <strong>Gym App</strong>.</p>
        <p>Get started by logging in and exploring your dashboard.</p>
        <a href="${process.env['CLIENT_URL']}" style="
          display: inline-block;
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 16px;
        ">Go to Dashboard</a>
      </div>
    `;

    this.html = html;
    this.subject = `Welcome to Gym App, ${name}!`;
    await this.sendMail();
  }
}

export const sendPasswordResetEmail = async (email: string, resetUrl: string): Promise<boolean> => {
  try {
    const emailService = new Email(email, {
      subject: 'Your Password Reset Token (Valid for 10 minutes)',
      html: '', // سيُملأ في sendPasswordReset
    });

    await emailService.sendPasswordReset(resetUrl);
    return true;
  } catch (error) {
    console.error('Failed to send reset email:', error);
    return false;
  }
};