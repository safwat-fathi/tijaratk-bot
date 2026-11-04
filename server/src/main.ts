import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { getSettings } from './config.js';
import { configureHttp } from './http-setup.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
configureHttp(app);
app.enableShutdownHooks();
await app.listen(getSettings().PORT, '0.0.0.0');
