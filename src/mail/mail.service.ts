import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { formatActivationCodeForDisplay } from '../common/utils/activation-code.util';

export interface InviteEmailInput {
  to: string;
  firstName: string;
  companyName: string;
  roleLabel: string;
  /** HTTPS page where the rider sets their password (works without the mobile app). */
  activationUrl: string;
  /** Raw token to paste into the FleetOps app → Activate account. */
  activationToken: string;
  expiresHours: number;
  /** When true, copy mentions the phone app as an optional path. */
  mobileApp?: boolean;
}

export interface RiderNoticeEmailInput {
  to: string;
  firstName: string;
  companyName: string;
  subject: string;
  headline: string;
  bodyLines: string[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const host = this.configService.get<string>('app.mail.host');
    const user = this.configService.get<string>('app.mail.user');
    const pass = this.configService.get<string>('app.mail.pass');
    return Boolean(host && user && pass);
  }

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.getOrThrow<string>('app.mail.host');
    const port = this.configService.get<number>('app.mail.port') ?? 587;
    const user = this.configService.getOrThrow<string>('app.mail.user');
    const pass = (this.configService.getOrThrow<string>('app.mail.pass') ?? '').replace(
      /\s+/g,
      '',
    );
    const rejectUnauthorized =
      this.configService.get<boolean>('app.mail.rejectUnauthorized') ?? false;

    const options: SMTPTransport.Options = {
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized },
    };

    this.transporter = nodemailer.createTransport(options);
    return this.transporter;
  }

  async sendInviteActivationEmail(input: InviteEmailInput): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        'Mailer is not configured. Set MAILER_HOST, MAILER_PRODUCER_EMAIL, and MAILER_PRODUCER_PASSWORD.',
      );
    }

    const from = this.configService.getOrThrow<string>('app.mail.user');
    const codeDisplay = formatActivationCodeForDisplay(input.activationToken);
    const subject = input.mobileApp
      ? `Your FleetOps code ${input.activationToken} — ${input.companyName}`
      : `Activate your ${input.companyName} account`;

    const text = input.mobileApp
      ? [
          `Hello ${input.firstName},`,
          '',
          `You have been invited to join ${input.companyName} as a ${input.roleLabel}.`,
          '',
          `Your 6-character activation code:`,
          input.activationToken,
          '',
          `Type this code in FleetOps → Activate account, then choose a password.`,
          '',
          `Or open this link on any device:`,
          input.activationUrl,
          '',
          `This code expires in ${input.expiresHours} hours.`,
          `After activation, sign in with your email and password, then go Online for live GPS.`,
        ].join('\n')
      : [
          `Hello ${input.firstName},`,
          '',
          `You have been invited to join ${input.companyName} as ${input.roleLabel}.`,
          '',
          `Activate your account:`,
          input.activationUrl,
          '',
          `Or enter this 6-character code: ${input.activationToken}`,
          '',
          `This link expires in ${input.expiresHours} hours.`,
          '',
          `After activation, sign in with your email and the password you choose.`,
          '',
          `If you did not expect this invite, ignore this email.`,
        ].join('\n');

    const html = input.mobileApp
      ? `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;line-height:1.5;color:#0f172a">
        <p>Hello ${escapeHtml(input.firstName)},</p>
        <p>You have been invited to join <strong>${escapeHtml(input.companyName)}</strong> as a <strong>${escapeHtml(input.roleLabel)}</strong>.</p>
        <p style="margin:20px 0 8px;font-weight:600">Your activation code</p>
        <p style="font-family:ui-monospace,Consolas,monospace;font-size:28px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:18px 16px;text-align:center;letter-spacing:0.35em;user-select:all;-webkit-user-select:all">
          ${escapeHtml(codeDisplay)}
        </p>
        <p style="font-size:14px;color:#334155">Open FleetOps → <strong>Activate account</strong> → type this code → choose a password.</p>
        <p style="margin:24px 0 8px">Or tap below to activate in the browser:</p>
        <p style="margin:16px 0">
          <a href="${escapeAttr(input.activationUrl)}"
             style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:600">
            Activate account
          </a>
        </p>
        <p style="font-size:13px;color:#64748b">Expires in ${input.expiresHours} hours. After activation, sign in and go <strong>Online</strong> so dispatch can see your live GPS.</p>
      </div>
    `
      : `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;line-height:1.5;color:#0f172a">
        <p>Hello ${escapeHtml(input.firstName)},</p>
        <p>You have been invited to join <strong>${escapeHtml(input.companyName)}</strong> as <strong>${escapeHtml(input.roleLabel)}</strong>.</p>
        <p>Activate your account in the browser:</p>
        <p style="margin:24px 0">
          <a href="${escapeAttr(input.activationUrl)}"
             style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:600">
            Activate account
          </a>
        </p>
        <p style="font-size:13px;color:#64748b">Or enter this code:<br/>
          <span style="font-family:ui-monospace,Consolas,monospace;font-size:22px;font-weight:700;letter-spacing:0.3em">${escapeHtml(codeDisplay)}</span>
        </p>
        <p style="font-size:13px;color:#64748b">Expires in ${input.expiresHours} hours. After activation, sign in with your email and the password you set.</p>
      </div>
    `;

    await this.getTransporter().sendMail({
      from: `"FleetOps" <${from}>`,
      to: input.to,
      subject,
      text,
      html,
    });

    this.logger.log(`Invite email sent to ${input.to} (mobileApp=${Boolean(input.mobileApp)})`);
  }

  /**
   * Best-effort notice to a rider. Logs and swallows mail failures so ops actions still succeed.
   */
  async sendRiderNoticeEmail(input: RiderNoticeEmailInput): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn(`Skipped rider notice to ${input.to}: mailer not configured`);
      return false;
    }

    try {
      const from = this.configService.getOrThrow<string>('app.mail.user');
      const text = [
        `Hello ${input.firstName},`,
        '',
        input.headline,
        '',
        ...input.bodyLines,
        '',
        `— ${input.companyName} via FleetOps`,
      ].join('\n');

      const html = `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;line-height:1.5;color:#0f172a">
          <p>Hello ${escapeHtml(input.firstName)},</p>
          <p><strong>${escapeHtml(input.headline)}</strong></p>
          ${input.bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          <p style="font-size:13px;color:#64748b;margin-top:24px">— ${escapeHtml(input.companyName)} via FleetOps</p>
        </div>
      `;

      await this.getTransporter().sendMail({
        from: `"FleetOps" <${from}>`,
        to: input.to,
        subject: input.subject,
        text,
        html,
      });
      this.logger.log(`Rider notice emailed to ${input.to}: ${input.subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed rider notice to ${input.to}: ${String(error)}`);
      return false;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
