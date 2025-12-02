import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { FacilitatorController } from "./facilitator.controller";
import { FacilitatorService } from "./facilitator.service";
import { HealthController } from "./health.controller";
import { MetricsModule } from "../common/metrics/metrics.module";
import { DiscoveryModule } from "../discovery/discovery.module";
import { ConfigModule } from "../config/config.module";
import { WalletPoolModule } from "./wallet-pool/wallet-pool.module";

@Module({
  imports: [
    TerminusModule,
    MetricsModule,
    ConfigModule,
    WalletPoolModule,
    // Conditionally import DiscoveryModule only if database is enabled
    ...(process.env.DATABASE_URL ? [DiscoveryModule] : []),
  ],
  controllers: [FacilitatorController, HealthController],
  providers: [FacilitatorService],
})
export class FacilitatorModule {}
