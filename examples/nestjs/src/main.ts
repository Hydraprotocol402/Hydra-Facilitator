import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Validate configuration on startup
  const configService = app.get(ConfigService);
  configService.validate();

  const port = configService.port;
  await app.listen(port);

  console.log(`X402 Facilitator Server listening at http://localhost:${port}`);
  console.log(`Endpoints:`);
  console.log(`  POST /verify - Verify x402 payments`);
  console.log(`  POST /settle - Settle x402 payments`);
  console.log(`  GET  /supported - Get supported payment kinds`);
}

bootstrap();
