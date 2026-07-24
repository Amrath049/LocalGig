import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    this.logger.log(`Register api called with email: ${dto.email}`);
    try {
      return await this.authService.register(dto);
    } catch (error) {
      this.logger.error(`Register api failed for email: ${dto.email}`);
      throw error;
    }
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    this.logger.log(`Login api called with email: ${dto.email}`);
    try {
      return await this.authService.login(dto.email, dto.password, dto.role);
    } catch (error) {
      this.logger.error(`Login api failed for email: ${dto.email}`);
      throw error;
    }
  }

  @Post('verify')
  async verify(@Body() dto: VerifyOtpDto) {
    this.logger.log(`Verify api called with email: ${dto.email}`);
    try {
      return await this.authService.verifyEmailOtp(dto.email, dto.otp);
    } catch (error) {
      this.logger.error(`Verify api failed for email: ${dto.email}`);
      throw error;
    }
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    this.logger.log('Refresh api called');
    try {
      return await this.authService.refresh(refreshToken);
    } catch (error) {
      this.logger.error('Refresh api failed');
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body('refreshToken') refreshToken: string,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Logout api called by user: ${user?.email ?? user?.id}`);
    try {
      return await this.authService.logout(refreshToken);
    } catch (error) {
      this.logger.error(
        `Logout api failed for user: ${user?.email ?? user?.id}`,
      );
      throw error;
    }
  }
}
