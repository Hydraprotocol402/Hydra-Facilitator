import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Gauge, register } from "prom-client";

@Injectable()
export class MetricsService {
  private readonly httpRequestCounter: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestSize: Histogram<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly errorCounter: Counter<string>;
  private readonly businessMetrics: Map<string, Counter<string>>;

  constructor() {
    // HTTP request metrics
    this.httpRequestCounter = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.httpRequestSize = new Histogram({
      name: "http_request_size_bytes",
      help: "Size of HTTP requests in bytes",
      labelNames: ["method", "route"],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
      registers: [register],
    });

    // Connection metrics
    this.activeConnections = new Gauge({
      name: "http_active_connections",
      help: "Number of active HTTP connections",
      registers: [register],
    });

    // Error metrics
    this.errorCounter = new Counter({
      name: "http_errors_total",
      help: "Total number of HTTP errors",
      labelNames: ["method", "route", "status_code", "error_type"],
      registers: [register],
    });

    // Business metrics map
    this.businessMetrics = new Map();
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
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
    });

    this.httpRequestDuration.observe(
      {
        method,
        route: normalizedRoute,
        status_code: statusCode.toString(),
      },
      duration / 1000, // Convert to seconds
    );

    if (requestSize) {
      this.httpRequestSize.observe(
        {
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
      method,
      route: normalizedRoute,
      status_code: statusCode.toString(),
      error_type: errorType,
    });
  }

  incrementActiveConnections(): void {
    this.activeConnections.inc();
  }

  decrementActiveConnections(): void {
    this.activeConnections.dec();
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

  private normalizeRoute(route: string): string {
    // Normalize routes by removing IDs and parameters
    return route
      .replace(/\/\d+/g, "/:id")
      .replace(/\/[a-f0-9-]{36}/gi, "/:uuid")
      .replace(/\/[a-zA-Z0-9]{32,}/g, "/:hash")
      .split("?")[0]; // Remove query parameters
  }
}
