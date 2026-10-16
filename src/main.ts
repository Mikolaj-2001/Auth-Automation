import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
import { join } from 'path';
const hbs: any = require('hbs');
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });

  app.use(cookieParser());

  const loginLimitation = rateLimit({
    windowMs: 20 * 60 * 1000, // 20 minut-czas odnowienia limitu
    max: 5, // 5 prób na 20 minut
    message: 'Osiągnięto maksymalną ilość prób. Spróbuj później.',
    standardHeaders: true, // Informacje o limicie w nagłówkach
    legacyHeaders: false, // Wyłączenie starych nagłówków
  });

  // Views are copied to dist/views during the build (nest-cli.json -> assets)
  const viewsDir = join(__dirname, 'views');
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('hbs');
  app.set('view options', { layout: 'layouts/main' });

  app.useStaticAssets(join(__dirname, '..', 'public'));

  hbs.registerPartials(join(viewsDir, 'partials'));

  hbs.registerHelper('uppercase', (str: string) => str.toUpperCase());
  hbs.registerHelper('lowercase', (str: string) => str.toLowerCase());

  const port = process.env.PORT ?? 9800;
  await app.listen(port);
  console.log('App has started successfully on port', port);

  app.use('/user/login', loginLimitation);
}
bootstrap();
