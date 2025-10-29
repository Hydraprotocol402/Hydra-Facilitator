import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use X-Forwarded-For header if behind proxy, otherwise use IP
    const forwarded = req.headers?.["x-forwarded-for"];
    if (forwarded) {
      return Array.isArray(forwarded)
        ? forwarded[0].split(",")[0].trim()
        : forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "unknown";
  }
}
