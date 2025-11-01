import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { FacilitatorController } from "./facilitator.controller";
import { FacilitatorService } from "./facilitator.service";
import { HealthController } from "./health.controller";
import { MetricsModule } from "../common/metrics/metrics.module";

@Module({
  imports: [TerminusModule, MetricsModule],
  controllers: [FacilitatorController, HealthController],
  providers: [FacilitatorService],
})
export class FacilitatorModule {}
