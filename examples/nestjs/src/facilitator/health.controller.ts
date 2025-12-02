import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Optional,
  UseGuards,
} from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { ApiKeyGuard, RequireApiKey } from "../common/guards/api-key.guard";
import { WalletPoolService } from "./wallet-pool";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    @Optional() private walletPoolService?: WalletPoolService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const checks = [
      () => this.memory.checkHeap("memory_heap", 500 * 1024 * 1024), // 500MB
      () => this.memory.checkRSS("memory_rss", 1000 * 1024 * 1024), // 1GB
    ];

    // Add wallet pool health check if available
    if (this.walletPoolService && this.walletPoolService.isPoolAvailable()) {
      checks.push(() => this.checkWalletPool());
    }

    return this.health.check(checks);
  }

  @Get("ready")
  @HealthCheck()
  ready() {
    const checks = [
      () => this.memory.checkHeap("memory_heap", 500 * 1024 * 1024),
    ];

    // Add wallet pool readiness check if available
    if (this.walletPoolService && this.walletPoolService.isPoolAvailable()) {
      checks.push(() => this.checkWalletPoolReady());
    }

    return this.health.check(checks);
  }

  /**
   * Custom health indicator for wallet pool
   */
  private async checkWalletPool(): Promise<HealthIndicatorResult> {
    const status = this.walletPoolService!.getPoolStatus();
    const isHealthy = status.healthyWallets > 0;

    return {
      wallet_pool: {
        status: isHealthy ? "up" : "down",
        totalWallets: status.totalWallets,
        healthyWallets: status.healthyWallets,
        unhealthyWallets: status.unhealthyWallets,
        pendingTxs: status.totalPendingTxs,
      },
    };
  }

  /**
   * Readiness check for wallet pool - requires at least half of wallets to be healthy
   */
  private async checkWalletPoolReady(): Promise<HealthIndicatorResult> {
    const status = this.walletPoolService!.getPoolStatus();
    const minHealthyRequired = Math.ceil(status.totalWallets / 2);
    const isReady = status.healthyWallets >= minHealthyRequired;

    return {
      wallet_pool_ready: {
        status: isReady ? "up" : "down",
        healthyWallets: status.healthyWallets,
        required: minHealthyRequired,
        totalWallets: status.totalWallets,
      },
    };
  }

  @Get("live")
  live() {
    // Liveness only checks if process is running
    return { status: "live", timestamp: new Date().toISOString() };
  }

  @Get("test/error")
  @UseGuards(ApiKeyGuard)
  @RequireApiKey()
  testError() {
    // Test endpoint to trigger error metrics
    // Requires X-API-Key header with ALERT_TEST_API_KEY value
    // Call this multiple times to trigger HighErrorRate alert
    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Test error for alerting system",
        error: "Internal Server Error",
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  @Get("test/slow")
  @UseGuards(ApiKeyGuard)
  @RequireApiKey()
  async testSlow() {
    // Test endpoint to trigger slow response time alerts
    // Requires X-API-Key header with ALERT_TEST_API_KEY value
    // Waits 2 seconds to simulate slow response (P95 threshold is 1s)
    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        // eslint-disable-next-line no-undef
        setTimeout(() => resolve(), ms);
      });
    await delay(2000);
    return {
      status: "ok",
      message: "This was a slow response for testing alert thresholds",
      duration: "2000ms",
    };
  }

  @Get("test/metrics")
  @UseGuards(ApiKeyGuard)
  @RequireApiKey()
  testMetrics() {
    // Info endpoint about test endpoints
    // Requires X-API-Key header with ALERT_TEST_API_KEY value
    return {
      message: "Alert testing endpoints (protected by API key)",
      authentication: {
        header: "X-API-Key",
        envVar: "ALERT_TEST_API_KEY",
        note: "Set ALERT_TEST_API_KEY environment variable to use these endpoints",
      },
      endpoints: {
        error:
          "GET /health/test/error - Returns 500 error (triggers error rate metrics)",
        slow: "GET /health/test/slow - Returns after 2s (triggers slow response alerts)",
        metrics:
          "GET /health/test/metrics - This endpoint (returns test endpoint info)",
      },
      usage: {
        error:
          "Call /health/test/error multiple times to increase error rate above 1% threshold",
        slow: "Call /health/test/slow to trigger slow response alert (P95 > 1s)",
        alertRules:
          "Alerts trigger after conditions are met for the specified duration (see alerts.yml)",
        example:
          "curl -H 'X-API-Key: your-secret-key' https://api.hydraprotocol.org/health/test/error",
      },
    };
  }
}
