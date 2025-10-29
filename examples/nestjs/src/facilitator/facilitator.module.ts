import { Module } from "@nestjs/common";
import { FacilitatorController } from "./facilitator.controller";
import { FacilitatorService } from "./facilitator.service";

@Module({
  controllers: [FacilitatorController],
  providers: [FacilitatorService],
})
export class FacilitatorModule {}
