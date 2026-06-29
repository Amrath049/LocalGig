import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from '../users/users.repository';
import { RegisterDto } from './dto/register.dto';
import { randomBytes, createHash, randomInt } from 'crypto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenTTL: number;
  private readonly emailOtpTTL: number;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.accessTokenExpiresIn = config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    );
    this.refreshTokenTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.emailOtpTTL = 10 * 60 * 1000; // 10 minutes
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersRepository.createWithProfile({
      email: dto.email,
      passwordHash,
      role: dto.role,
      worker:
        dto.role === 'WORKER'
          ? {
              name: dto.name!,
              phone: dto.phone!,
              skillTags: dto.skillTags ?? [],
            }
          : undefined,
      employer:
        dto.role === 'EMPLOYER'
          ? { businessName: dto.businessName!, phone: dto.employerPhone! }
          : undefined,
    });

    const otp = this.generateOtp();
    await this.usersRepository.deleteEmailVerificationOtps(user.id);
    await this.usersRepository.createEmailVerificationOtp({
      userId: user.id,
      codeHash: this.hashToken(otp),
      expiresAt: new Date(Date.now() + this.emailOtpTTL),
    });
    console.log(`Registration OTP: ${otp}, for user: ${dto.email}`);
    await this.mailService.sendVerificationOtpEmail(
      user.email,
      otp,
      Math.floor(this.emailOtpTTL / 60000),
    );

    return {
      message: 'Registration successful. Check your email for the OTP.',
    };
  }

  async verifyEmailOtp(email: string, otp: string) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (user.isEmailVerified) {
      return { message: 'Email is already verified.' };
    }

    const record = await this.usersRepository.findEmailVerificationOtp(
      user.id,
      this.hashToken(otp),
    );

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.usersRepository.consumeEmailVerificationOtp(record.id);
    await this.usersRepository.markEmailVerified(user.id);
    return { message: 'Email verified successfully.' };
  }

  async login(email: string, password: string) {
    const user = await this.usersRepository.findByEmailWithProfiles(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email must be verified before login');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.usersRepository.findRefreshToken(tokenHash);
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const user = await this.usersRepository.findById(record.userId);
    if (!user) {
      await this.usersRepository.deleteRefreshTokenByHash(tokenHash);
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.usersRepository.deleteRefreshTokenByHash(tokenHash);
    const newRefreshToken = await this.createRefreshToken(user.id);
    const accessToken = await this.generateAccessToken(
      user.id,
      user.email,
      user.role,
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.usersRepository.deleteRefreshTokenByHash(tokenHash);
    return { message: 'Logged out successfully' };
  }

  async generateAccessToken(userId: string, email: string, role: string) {
    return this.jwtService.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessTokenExpiresIn as any,
      },
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }

  private async createRefreshToken(userId: string) {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenTTL);

    await this.usersRepository.createRefreshToken({
      userId,
      tokenHash,
      expiresAt,
    });
    return rawToken;
  }
}
