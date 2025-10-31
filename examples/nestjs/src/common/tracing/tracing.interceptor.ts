import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import * as opentelemetry from "@opentelemetry/api";

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly tracer = opentelemetry.trace.getTracer(
    "nestjs-tracing",
    "1.0.0",
  );

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, route } = request;

    const routePath = route?.path || url.split("?")[0];
    const spanName = `${method} ${routePath}`;

    const span = this.tracer.startSpan(spanName, {
      kind: opentelemetry.SpanKind.SERVER,
      attributes: {
        "http.method": method,
        "http.route": routePath,
        "http.url": url,
        "http.target": url,
      },
    });

    const requestId = (request as any).id;
    if (requestId) {
      span.setAttribute("request.id", requestId);
    }

    // Add span to context
    return opentelemetry.context.with(
      opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
      () => {
        return next.handle().pipe(
          tap({
            next: () => {
              const response = context.switchToHttp().getResponse();
              span.setAttribute("http.status_code", response.statusCode);
              span.setStatus({
                code:
                  response.statusCode >= 400
                    ? opentelemetry.SpanStatusCode.ERROR
                    : opentelemetry.SpanStatusCode.OK,
              });
              span.end();
            },
            error: (error) => {
              const statusCode = error.status || error.statusCode || 500;
              span.setAttribute("http.status_code", statusCode);
              span.setAttribute("error", true);
              span.setAttribute(
                "error.message",
                error.message || "Unknown error",
              );
              span.setStatus({
                code: opentelemetry.SpanStatusCode.ERROR,
                message: error.message,
              });
              span.end();
            },
          }),
        );
      },
    );
  }
}
