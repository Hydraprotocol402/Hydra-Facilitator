import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { PinoLogger } from "nestjs-pino";
import * as opentelemetry from "@opentelemetry/api";
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, route, headers, ip } = request;
    const requestId =
      request.id || request.headers["x-request-id"] || "unknown";

    const routePath = route?.path || url.split("?")[0];
    const startTime = Date.now();

    const span = opentelemetry.trace.getActiveSpan();
    const traceId = span?.spanContext().traceId;
    const spanId = span?.spanContext().spanId;

    // Enhanced request logging
    const logContext = {
      requestId,
      traceId,
      spanId,
      method,
      url,
      route: routePath,
      ip: ip || headers["x-forwarded-for"] || "unknown",
      userAgent: headers["user-agent"],
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(logContext, `Incoming request: ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          const logData = {
            ...logContext,
            statusCode,
            duration,
            responseSize: headers["content-length"]
              ? parseInt(headers["content-length"], 10)
              : undefined,
          };

          // Different log levels based on status code
          if (statusCode >= 500) {
            this.logger.error(
              logData,
              `${method} ${url} ${statusCode} - ${duration}ms`,
            );
          } else if (statusCode >= 400) {
            this.logger.warn(
              logData,
              `${method} ${url} ${statusCode} - ${duration}ms`,
            );
          } else {
            this.logger.info(
              logData,
              `${method} ${url} ${statusCode} - ${duration}ms`,
            );
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || error.statusCode || 500;

          this.logger.error(
            {
              ...logContext,
              statusCode,
              duration,
              error: {
                name: error.name,
                message: error.message,
                stack:
                  process.env.NODE_ENV !== "production"
                    ? error.stack
                    : undefined,
              },
            },
            `${method} ${url} - Error: ${error.message}`,
          );
        },
      }),
    );
  }
}
