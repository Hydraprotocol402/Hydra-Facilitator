import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { randomUUID } from "crypto";

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Generate or use existing request ID
    const requestId = request.headers["x-request-id"] || randomUUID();

    // Attach to request for logging
    request.id = requestId;

    // Add to response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader("X-Request-Id", requestId);

    return next.handle();
  }
}
