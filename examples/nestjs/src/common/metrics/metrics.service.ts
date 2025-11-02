import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Gauge, register } from "prom-client";
import { formatEther } from "viem";
import { SupportedEVMNetworks } from "x402-hydra-facilitator/types";

// Solana lamports to SOL conversion constant (1 SOL = 1,000,000,000 lamports)
const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

@Injectable()
export class MetricsService {
  private readonly httpRequestCounter: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestSize: Histogram<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly errorCounter: Counter<string>;
  private readonly businessMetrics: Map<string, Counter<string>>;
  private readonly paymentVerificationCounter: Counter<string>;
  private readonly paymentSettlementCounter: Counter<string>;
  private readonly paymentAmountHistogram: Histogram<string>;
  private readonly paymentVerificationDuration: Histogram<string>;
  private readonly paymentSettlementDuration: Histogram<string>;
  private readonly paymentConfirmationWaitDuration: Histogram<string>;
  private readonly facilitatorGasBalance: Gauge<string>;
  private readonly serviceName: string;

  constructor() {
    // Get service name and environment from env or defaults
    this.serviceName =
      process.env.OTEL_SERVICE_NAME ||
      process.env.SERVICE_NAME ||
      "hydra-x402-facilitator";

    // HTTP request metrics
    // Include service and environment labels for better filtering/grouping
    this.httpRequestCounter = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["service", "method", "route", "status_code"],
      registers: [register],
      // Set default label values (will be overridden per metric if needed)
    });

    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["service", "method", "route", "status_code"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.httpRequestSize = new Histogram({
      name: "http_request_size_bytes",
      help: "Size of HTTP requests in bytes",
      labelNames: ["service", "method", "route"],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
      registers: [register],
    });

    // Connection metrics
    this.activeConnections = new Gauge({
      name: "http_active_connections",
      help: "Number of active HTTP connections",
      labelNames: ["service"],
      registers: [register],
    });

    // Error metrics
    this.errorCounter = new Counter({
      name: "http_errors_total",
      help: "Total number of HTTP errors",
      labelNames: ["service", "method", "route", "status_code", "error_type"],
      registers: [register],
    });

    // Business metrics map
    this.businessMetrics = new Map();

    // Payment verification metrics
    this.paymentVerificationCounter = new Counter({
      name: "payment_verification_total",
      help: "Total number of payment verifications",
      labelNames: ["network", "scheme", "result", "reason"],
      registers: [register],
    });

    // Payment settlement metrics
    this.paymentSettlementCounter = new Counter({
      name: "payment_settlement_total",
      help: "Total number of payment settlements",
      labelNames: ["network", "scheme", "result", "reason"],
      registers: [register],
    });

    // Payment amount histogram
    this.paymentAmountHistogram = new Histogram({
      name: "payment_amount_total",
      help: "Payment amounts in atomic units",
      labelNames: ["network", "scheme"],
      buckets: [
        1000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000,
        50000000, 100000000,
      ],
      registers: [register],
    });

    // Payment verification duration
    this.paymentVerificationDuration = new Histogram({
      name: "payment_verification_duration_seconds",
      help: "Duration of payment verification in seconds",
      labelNames: ["network", "scheme"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    // Payment settlement duration
    this.paymentSettlementDuration = new Histogram({
      name: "payment_settlement_duration_seconds",
      help: "Duration of payment settlement in seconds",
      labelNames: ["network", "scheme"],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [register],
    });

    // Transaction confirmation wait time
    this.paymentConfirmationWaitDuration = new Histogram({
      name: "payment_confirmation_wait_seconds",
      help: "Time waiting for blockchain confirmation in seconds",
      labelNames: ["network", "scheme"],
      buckets: [1, 2, 5, 10, 30, 60, 120, 300],
      registers: [register],
    });

    // Facilitator gas balance gauge
    this.facilitatorGasBalance = new Gauge({
      name: "facilitator_gas_balance",
      help: "Facilitator wallet gas balance in native token units (ETH for EVM, SOL for SVM)",
      labelNames: ["network", "wallet_address"],
      registers: [register],
    });
  }

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
  ): void {
    const normalizedRoute = this.normalizeRoute(route);

    this.httpRequestCounter.inc({
      service: this.serviceName,
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
    });

    this.httpRequestDuration.observe(
      {
        service: this.serviceName,
        method,
        route: normalizedRoute,
        status_code: statusCode.toString(),
      },
      duration / 1000, // Convert to seconds
    );

    if (requestSize) {
      this.httpRequestSize.observe(
        {
          service: this.serviceName,
          method,
          route: normalizedRoute,
        },
        requestSize,
      );
    }
  }

  recordError(
    method: string,
    route: string,
    statusCode: number,
    errorType: string,
  ): void {
    const normalizedRoute = this.normalizeRoute(route);

    this.errorCounter.inc({
      service: this.serviceName,
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
      error_type: errorType,
    });
  }

  incrementActiveConnections(): void {
    this.activeConnections.inc({ service: this.serviceName });
  }

  decrementActiveConnections(): void {
    this.activeConnections.dec({ service: this.serviceName });
  }

  recordBusinessMetric(
    metricName: string,
    labels: Record<string, string> = {},
    value: number = 1,
  ): void {
    const key = `${metricName}_${JSON.stringify(labels)}`;

    if (!this.businessMetrics.has(key)) {
      this.businessMetrics.set(
        key,
        new Counter({
          name: `business_${metricName}_total`,
          help: `Business metric: ${metricName}`,
          labelNames: Object.keys(labels),
          registers: [register],
        }),
      );
    }

    const counter = this.businessMetrics.get(key)!;
    counter.inc(labels, value);
  }

  recordPaymentVerification(
    network: string,
    scheme: string,
    result: "success" | "failure",
    reason: string,
    durationSeconds: number,
  ): void {
    this.paymentVerificationCounter.inc({
      network,
      scheme,
      result,
      reason: reason || "none",
    });

    this.paymentVerificationDuration.observe(
      { network, scheme },
      durationSeconds,
    );
  }

  recordPaymentSettlement(
    network: string,
    scheme: string,
    result: "success" | "failure",
    reason: string,
    durationSeconds: number,
    confirmationWaitSeconds?: number,
  ): void {
    this.paymentSettlementCounter.inc({
      network,
      scheme,
      result,
      reason: reason || "none",
    });

    this.paymentSettlementDuration.observe(
      { network, scheme },
      durationSeconds,
    );

    if (confirmationWaitSeconds !== undefined) {
      this.paymentConfirmationWaitDuration.observe(
        { network, scheme },
        confirmationWaitSeconds,
      );
    }
  }

  recordPaymentAmount(network: string, scheme: string, amount: number): void {
    this.paymentAmountHistogram.observe({ network, scheme }, amount);
  }

  recordFacilitatorGasBalance(
    network: string,
    walletAddress: string,
    balanceWei: bigint,
  ): void {
    // Convert bigint to number for Prometheus
    // For EVM: balanceWei is in wei (18 decimals), convert to ETH using viem's formatEther
    // For SVM: balanceWei is in lamports (9 decimals), convert to SOL manually
    // This prevents precision loss when storing very large wei/lamport values

    // Determine if this is EVM or SVM based on supported network arrays
    // This is more robust than string matching and stays in sync with the package's network definitions
    const isEVM = SupportedEVMNetworks.includes(network as any);
    let balanceNative: number;

    if (isEVM) {
      // Use viem's formatEther to convert wei to ETH (returns string, then parse to number)
      balanceNative = parseFloat(formatEther(balanceWei));
    } else {
      // For SVM: convert lamports to SOL using constant (similar to viem's approach)
      // 1 SOL = 1,000,000,000 lamports
      balanceNative = Number(balanceWei) / Number(LAMPORTS_PER_SOL);
    }

    // Store wallet address as string label (sanitize to ensure it's treated as string)
    const sanitizedAddress = String(walletAddress);

    this.facilitatorGasBalance.set(
      { network, wallet_address: sanitizedAddress },
      balanceNative,
    );
  }

  private normalizeRoute(route: string): string {
    // Normalize routes by removing IDs and parameters
    return route
      .replace(/\/\d+/g, "/:id")
      .replace(/\/[a-f0-9-]{36}/gi, "/:uuid")
      .replace(/\/[a-zA-Z0-9]{32,}/g, "/:hash")
      .split("?")[0]; // Remove query parameters
  }
}
