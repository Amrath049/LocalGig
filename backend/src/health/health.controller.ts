import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    console.log('Health check first');
    return { status: 'ok' };
  }
}
