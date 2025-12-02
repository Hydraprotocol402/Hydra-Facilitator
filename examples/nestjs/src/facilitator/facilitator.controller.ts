import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FacilitatorService } from "./facilitator.service";
import { VerifyRequestDto } from "./dto/verify.dto";
import { SettleRequestDto } from "./dto/settle.dto";
import {
  PaymentPayloadSchema,
  PaymentRequirementsSchema,
} from "x402-hydra-facilitator/types";
import { PinoLogger } from "nestjs-pino";
import { WalletPoolService } from "./wallet-pool";

@Controller()
export class FacilitatorController {
  constructor(
    private readonly facilitatorService: FacilitatorService,
    private readonly logger: PinoLogger,
    @Optional() private readonly walletPoolService?: WalletPoolService,
  ) {
    this.logger.setContext(FacilitatorController.name);
  }

  @Get("verify")
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  getVerifyInfo() {
    return {
      endpoint: "/verify",
      description: "POST to verify x402 payments",
      body: {
        paymentPayload: "PaymentPayload",
        paymentRequirements: "PaymentRequirements",
      },
    };
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  async verify(@Body() body: VerifyRequestDto) {
    try {
      // Validate schemas
      const paymentRequirements = PaymentRequirementsSchema.parse(
        body.paymentRequirements,
      );
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      this.logger.info(
        {
          network: paymentRequirements.network,
          scheme: paymentPayload.scheme,
        },
        "Verifying payment",
      );

      return await this.facilitatorService.verifyPayment(
        paymentPayload,
        paymentRequirements,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Payment verification failed",
      );

      throw new BadRequestException(
        `Invalid request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  @Get("settle")
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  getSettleInfo() {
    return {
      endpoint: "/settle",
      description: "POST to settle x402 payments",
      body: {
        paymentPayload: "PaymentPayload",
        paymentRequirements: "PaymentRequirements",
      },
    };
  }

  @Post("settle")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  async settle(@Body() body: SettleRequestDto) {
    try {
      // Validate schemas
      const paymentRequirements = PaymentRequirementsSchema.parse(
        body.paymentRequirements,
      );
      const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

      this.logger.info(
        {
          network: paymentRequirements.network,
          scheme: paymentPayload.scheme,
        },
        "Settling payment",
      );

      return await this.facilitatorService.settlePayment(
        paymentPayload,
        paymentRequirements,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Payment settlement failed",
      );

      throw new BadRequestException(
        `Invalid request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  @Get("supported")
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async getSupported() {
    return await this.facilitatorService.getSupportedPaymentKinds();
  }

  @Get("pool/status")
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  getPoolStatus() {
    if (!this.walletPoolService || !this.walletPoolService.isPoolAvailable()) {
      return {
        enabled: false,
        message: "Wallet pool is not enabled or not initialized",
        mode: "single-wallet",
      };
    }

    const status = this.walletPoolService.getPoolStatus();
    const config = this.walletPoolService.getConfig();

    return {
      enabled: true,
      mode: "multi-wallet-pool",
      config: {
        selectionStrategy: config.selectionStrategy,
        maxPendingPerWallet: config.maxPendingPerWallet,
        minEthBalance: config.minEthBalance.toString(),
        maxRetryAttempts: config.maxRetryAttempts,
      },
      status: {
        totalWallets: status.totalWallets,
        healthyWallets: status.healthyWallets,
        unhealthyWallets: status.unhealthyWallets,
        totalPendingTxs: status.totalPendingTxs,
        averagePendingPerWallet: status.averagePendingPerWallet.toFixed(2),
      },
      wallets: status.wallets.map((w) => ({
        address: w.address,
        isHealthy: w.isHealthy,
        pendingTxCount: w.pendingTxCount,
        ethBalance: w.ethBalance,
        lastUsedAt: w.lastUsedAt > 0 ? new Date(w.lastUsedAt).toISOString() : null,
      })),
    };
  }
}
