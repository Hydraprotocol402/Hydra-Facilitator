import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "./config/config.module";
import { FacilitatorModule } from "./facilitator/facilitator.module";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { ConfigService } from "./config/config.service";
import {
  RequestIdInterceptor,
  LoggingInterceptor,
  MetricsInterceptor,
  TracingInterceptor,
  PerformanceInterceptor,
} from "./common";
import { MetricsModule } from "./common/metrics/metrics.module";
import { TracingModule } from "./common/tracing/tracing.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ThrottlerBehindProxyGuard } from "./common/guards/throttler-behind-proxy.guard";
import { ApiKeyGuard } from "./common/guards/api-key.guard";
import { TerminusModule } from "@nestjs/terminus";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./common/prisma/prisma.module";

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable scheduling for periodic tasks
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  translateTime: "HH:MM:ss Z",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            route: req.route?.path,
            ip: req.ip,
            userAgent: req.headers["user-agent"],
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
          err: (err) => ({
            type: err.type,
            message: err.message,
            stack:
              process.env.NODE_ENV !== "production" ? err.stack : undefined,
          }),
        },
        customProps: () => ({
          context: "HTTP",
        }),
        // Add request ID to all logs
        genReqId: (req) => {
          return (
            req.headers["x-request-id"] ||
            req.id ||
            `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          );
        },
      },
    }),
    ConfigModule,
    PrismaModule, // Prisma database client
    MetricsModule, // Prometheus metrics
    TracingModule, // OpenTelemetry tracing
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.rateLimitTtl * 1000,
            limit: Math.max(
              config.rateLimitVerify,
              config.rateLimitSettle,
              config.rateLimitSupported,
            ),
          },
        ],
      }),
    }),
    TerminusModule,
    FacilitatorModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    ApiKeyGuard, // Register guard for dependency injection
    // Interceptors are executed in reverse order of registration
    // So RequestIdInterceptor runs first, then Tracing, then Metrics, then Performance, then Logging
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TracingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
