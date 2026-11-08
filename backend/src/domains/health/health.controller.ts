import { Controller, Get, Inject } from '@nestjs/common';
import type { Settings } from '../../config.js';
import { SETTINGS } from '../../core/tokens.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(SETTINGS) private readonly s: Settings) {}

  @Get()
  check() {
    return { status: 'ok', version: this.s.VERSION };
  }
}

@Controller()
export class RootController {
  @Get()
  root() {
    return { message: 'Welcome to the TijaratkBot API', docs: '/docs' };
  }
}
