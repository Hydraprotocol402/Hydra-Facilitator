import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

interface PerformanceMetrics {
  duration: number;
  startMemory: ReturnType<typeof process.memoryUsage>;
  endMemory?: ReturnType<typeof process.memoryUsage>;
  memoryDelta?: number;
}

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);
  private readonly slowRequestThreshold: number;

  constructor() {
    this.slowRequestThreshold = parseInt(
      process.env.SLOW_REQUEST_THRESHOLD || "1000",
      10,
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, route } = request;
    const routePath = route?.path || url.split("?")[0];

    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    const metrics: PerformanceMetrics = {
      duration: 0,
      startMemory,
    };

    return next.handle().pipe(
      tap({
        next: () => {
          const endTime = process.hrtime.bigint();
          const endMemory = process.memoryUsage();
          const durationMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

          metrics.duration = durationMs;
          metrics.endMemory = endMemory;
          metrics.memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

          // Log slow requests
          if (durationMs > this.slowRequestThreshold) {
            this.logger.warn(
              {
                method,
                route: routePath,
                duration: durationMs,
                memoryDelta: metrics.memoryDelta,
                heapUsed: endMemory.heapUsed,
                heapTotal: endMemory.heapTotal,
              },
              `Slow request detected: ${method} ${routePath} took ${durationMs.toFixed(2)}ms`,
            );
          }

          // Log memory issues
          const heapUsagePercent =
            (endMemory.heapUsed / endMemory.heapTotal) * 100;
          if (heapUsagePercent > 90) {
            this.logger.warn(
              {
                method,
                route: routePath,
                heapUsagePercent: heapUsagePercent.toFixed(2),
                heapUsed: endMemory.heapUsed,
                heapTotal: endMemory.heapTotal,
              },
              `High memory usage detected: ${heapUsagePercent.toFixed(2)}%`,
            );
          }
        },
        error: () => {
          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1_000_000;
          const endMemory = process.memoryUsage();

          this.logger.error(
            {
              method,
              route: routePath,
              duration: durationMs,
              memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
            },
            `Request failed: ${method} ${routePath}`,
          );
        },
      }),
    );
  }
}
