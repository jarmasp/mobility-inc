import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter = this.createTransporter();
  private readonly from = process.env.SMTP_FROM ?? 'noreply@mobility.local';

  async sendWelcomeRider(input: { email: string; name: string }): Promise<void> {
    await this.sendTemplateEmail({
      to: input.email,
      subject: 'Welcome to Mobility',
      templateFile: 'welcome-rider.txt',
      vars: {
        name: input.name,
      },
    });
  }

  async sendDepositConfirmed(input: {
    email: string;
    name: string;
    amount: number;
    balance: number;
  }): Promise<void> {
    await this.sendTemplateEmail({
      to: input.email,
      subject: 'Deposit confirmed',
      templateFile: 'deposit-confirmed.txt',
      vars: {
        name: input.name,
        amount: input.amount.toFixed(2),
        balance: input.balance.toFixed(2),
      },
    });
  }

  private async sendTemplateEmail(input: {
    to: string;
    subject: string;
    templateFile: string;
    vars: Record<string, string>;
  }): Promise<void> {
    const template = await this.readTemplate(input.templateFile);
    const rendered = Object.entries(input.vars).reduce((text, [key, value]) => {
      return text.replaceAll(`{{${key}}}`, value);
    }, template);

    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: rendered,
    });
  }

  private async readTemplate(templateFile: string): Promise<string> {
    const templatePath = path.join(
      __dirname,
      'templates',
      templateFile,
    );
    try {
      return await readFile(templatePath, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to read template ${templateFile}`, error);
      throw error;
    }
  }

  private createTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      this.logger.warn('SMTP not configured. Emails will be logged only.');
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
    });
  }
}
