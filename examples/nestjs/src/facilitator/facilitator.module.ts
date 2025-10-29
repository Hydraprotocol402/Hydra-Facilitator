import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { FacilitatorController } from "./facilitator.controller";
import { FacilitatorService } from "./facilitator.service";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule],
  controllers: [FacilitatorController, HealthController],
  providers: [FacilitatorService],
})
export class FacilitatorModule {}
