import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).id || "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errorReason: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null
      ) {
        const errorObj = exceptionResponse as any;
        message = errorObj.message || exception.message;

        // Preserve invalidReason from x402 responses
        if (errorObj.invalidReason) {
          errorReason = errorObj.invalidReason;
        }
        if (errorObj.errorReason) {
          errorReason = errorObj.errorReason;
        }
      }
    } else if (exception instanceof Error) {
      message = "An unexpected error occurred";
      // Log full error but don't expose it to client
    }

    // For x402 endpoints, preserve the response structure
    const isX402Endpoint =
      request.url.includes("/verify") || request.url.includes("/settle");

    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    if (isX402Endpoint) {
      // For x402 endpoints, return structured error matching x402 spec
      if (request.url.includes("/verify")) {
        errorResponse.isValid = false;
        errorResponse.invalidReason = errorReason || "unexpected_verify_error";
        errorResponse.payer = ""; // Try to extract from body if possible
      } else if (request.url.includes("/settle")) {
        errorResponse.success = false;
        errorResponse.errorReason = errorReason || "unexpected_settle_error";
        errorResponse.transaction = "";
        errorResponse.network = "";
        errorResponse.payer = "";
      }
    } else {
      errorResponse.message = message;
    }

    // Only log full stack trace in development
    if (process.env.NODE_ENV !== "production") {
      errorResponse.stack =
        exception instanceof Error ? exception.stack : undefined;
    }

    response.status(status).json(errorResponse);
  }
}
