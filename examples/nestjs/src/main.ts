import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";
import helmet from "helmet";
import { Logger } from "nestjs-pino";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);

  // Use Pino logger globally
  app.useLogger(logger);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for API
    }),
  );

  // CORS configuration
  if (configService.enableCors) {
    const corsOrigins = configService.corsOrigins;
    app.enableCors({
      origin: corsOrigins.length > 0 ? corsOrigins : "*",
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Validate configuration on startup
  configService.validate();

  const port = configService.port;
  await app.listen(port);

  logger.log(`X402 Facilitator Server listening at ${port}`);
  logger.log(`Endpoints:`);
  logger.log(`  POST /verify - Verify x402 payments`);
  logger.log(`  POST /settle - Settle x402 payments`);
  logger.log(`  GET  /supported - Get supported payment kinds`);
  logger.log(`  GET  /health - Health check`);
}

bootstrap();
