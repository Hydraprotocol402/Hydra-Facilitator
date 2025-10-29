import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { FacilitatorModule } from "./facilitator/facilitator.module";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { ConfigService } from "./config/config.service";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ThrottlerBehindProxyGuard } from "./common/guards/throttler-behind-proxy.guard";
import { TerminusModule } from "@nestjs/terminus";
import { LoggerModule } from "nestjs-pino";

@Module({
  imports: [
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
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        customProps: () => ({
          context: "HTTP",
        }),
      },
    }),
    ConfigModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
