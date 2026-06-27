import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  async sendVerificationOtpEmail(
    email: string,
    otp: string,
    expiresInMinutes: number,
  ) {
    const from = this.config.get<string>(
      'MAIL_FROM',
      'no-reply@localgig.local',
    );
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');

    const text = [
      'Welcome to LocalGig.',
      '',
      `Your email verification OTP is: ${otp}`,
      '',
      `This code expires in ${expiresInMinutes} minutes.`,
      'If you did not create a LocalGig account, you can ignore this email.',
    ].join('\n');

    const html = `
      <div style="margin:0;padding:0;background:#faf7f2;font-family:Arial,Helvetica,sans-serif;color:#2c1a0e;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf7f2;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf9;border:1px solid #e8ddd4;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(44,26,14,0.10);">
                <tr>
                  <td style="background:#7c4a2d;padding:28px 32px;color:#fffdf9;">
                    <div style="font-size:14px;letter-spacing:0.16em;text-transform:uppercase;color:#f5ede0;">LocalGig</div>
                    <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-family:Georgia,serif;font-weight:700;">Your local work passcode</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#5f4a3a;">You're almost in. Use this 6-digit code to verify your email and start using LocalGig.</p>
                    <div style="margin:26px 0;padding:20px 24px;background:#f5ede0;border:1px dashed #cfa989;border-radius:16px;text-align:center;">
                      <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8c7b6e;margin-bottom:8px;">Verification code</div>
                      <div style="font-size:40px;letter-spacing:0.22em;font-weight:800;color:#7c4a2d;">${otp}</div>
                    </div>
                    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#8c7b6e;">This code expires in ${expiresInMinutes} minutes. For your safety, do not share it with anyone.</p>
                    <div style="border-top:1px solid #e8ddd4;padding-top:18px;margin-top:24px;">
                      <p style="margin:0;font-size:13px;line-height:1.6;color:#8c7b6e;">If you did not create a LocalGig account, no action is needed.</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    if (!apiKey) {
      this.logger.warn(
        `SendGrid API key is not configured. Verification OTP for ${email}: ${otp}`,
      );
      return {
        message: 'Verification OTP logged in backend console.',
      };
    }

    const msg = {
      to: email,
      from,
      subject: 'Your LocalGig verification code',
      text,
      html,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Verification OTP email sent to ${email}`);
      return { message: 'Verification OTP email sent.' };
    } catch (error) {
      this.logger.error('SendGrid send failed', error as Error);
      return {
        message: 'Failed to send verification email. Check backend logs.',
      };
    }
  }
}
