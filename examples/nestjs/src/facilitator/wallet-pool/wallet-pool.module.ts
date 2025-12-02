import { Module } from "@nestjs/common";
import { WalletPoolService } from "./wallet-pool.service";
import { NonceManager } from "./nonce-manager";
import { WalletSelector } from "./wallet-selector";
import { ConfigModule } from "../../config/config.module";
import { MetricsModule } from "../../common/metrics/metrics.module";

@Module({
  imports: [ConfigModule, MetricsModule],
  providers: [WalletPoolService, NonceManager, WalletSelector],
  exports: [WalletPoolService, NonceManager],
})
export class WalletPoolModule {}



