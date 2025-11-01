import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";

// Decorator to mark endpoints that require API key
export const RequireApiKey = () => SetMetadata("requireApiKey", true);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if endpoint requires API key
    const requireApiKey = this.reflector.getAllAndOverride<boolean>(
      "requireApiKey",
      [context.getHandler(), context.getClass()],
    );

    if (!requireApiKey) {
      // Endpoint doesn't require API key, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    // Get API key from environment variable
    // Use a secure default in production, or generate one
    const expectedApiKey =
      process.env.ALERT_TEST_API_KEY || process.env.API_KEY || null;

    if (!expectedApiKey) {
      // No API key configured - disable test endpoints for security
      throw new UnauthorizedException(
        "API key authentication is required but not configured",
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException("Invalid or missing API key");
    }

    return true;
  }
}
