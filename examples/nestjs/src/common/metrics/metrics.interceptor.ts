import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { throwError } from "rxjs";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, route } = request;

    const routePath = route?.path || url.split("?")[0];
    const startTime = Date.now();

    // Track active connections
    this.metricsService.incrementActiveConnections();

    // Get request size if available
    const requestSize = request.headers["content-length"]
      ? parseInt(request.headers["content-length"], 10)
      : undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.metricsService.recordHttpRequest(
            method,
            routePath,
            statusCode,
            duration,
            requestSize,
          );

          // Record errors for non-2xx status codes
          if (statusCode >= 400) {
            const errorType =
              statusCode >= 500
                ? "server_error"
                : statusCode >= 400
                  ? "client_error"
                  : "unknown";
            this.metricsService.recordError(
              method,
              routePath,
              statusCode,
              errorType,
            );
          }

          this.metricsService.decrementActiveConnections();
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || error.statusCode || 500;
          const errorType = error.name || "unknown_error";

          this.metricsService.recordHttpRequest(
            method,
            routePath,
            statusCode,
            duration,
            requestSize,
          );

          this.metricsService.recordError(
            method,
            routePath,
            statusCode,
            errorType,
          );

          this.metricsService.decrementActiveConnections();
        },
      }),
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }
}
