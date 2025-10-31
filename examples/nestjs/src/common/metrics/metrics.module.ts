import { Module } from "@nestjs/common";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { MetricsService } from "./metrics.service";

@Module({
  imports: [
    PrometheusModule.register({
      path: "/metrics",
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
