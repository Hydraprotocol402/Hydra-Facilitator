import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

@Injectable()
export class TracingService implements OnModuleDestroy {
  private readonly logger = new Logger(TracingService.name);
  private sdk: NodeSDK | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const serviceName =
      process.env.OTEL_SERVICE_NAME || "hydra-x402-facilitator";
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";
    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

    try {
      // Initialize if explicitly enabled (recommended for production)
      // Defaults to enabled if OTEL_EXPORTER_OTLP_ENDPOINT is set
      const tracingEnabled =
        process.env.OTEL_ENABLED === "true" ||
        (process.env.NODE_ENV !== "production" &&
          process.env.OTEL_ENABLED !== "false") ||
        !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

      if (!tracingEnabled) {
        this.logger.debug("OpenTelemetry tracing is disabled");
        this.isInitialized = true;
        return;
      }

      this.sdk = new NodeSDK({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: serviceName,
          [ATTR_SERVICE_VERSION]: serviceVersion,
        }),
        traceExporter: new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
            ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
            : {},
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            // Only enable what we need
            "@opentelemetry/instrumentation-fs": {
              enabled: false,
            },
            "@opentelemetry/instrumentation-dns": {
              enabled: false,
            },
          }),
        ],
      });

      await this.sdk.start();
      this.isInitialized = true;
      this.logger.log(
        `OpenTelemetry tracing initialized for service: ${serviceName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize OpenTelemetry: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - allow app to continue without tracing
      this.isInitialized = true;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log("OpenTelemetry tracing shut down");
      } catch (error) {
        this.logger.error(
          `Error shutting down OpenTelemetry: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  isTracingEnabled(): boolean {
    return this.isInitialized && this.sdk !== null;
  }
}
