import { Injectable, BadRequestException } from "@nestjs/common";
import { verify, settle } from "x402-hydra-facilitator/facilitator";
import {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  createConnectedClient,
  createSigner,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  isSvmSignerWallet,
  SupportedPaymentKind,
  Signer,
  ConnectedClient,
} from "x402-hydra-facilitator/types";
import { ConfigService } from "../config/config.service";
import { PinoLogger } from "nestjs-pino";
import { MetricsService } from "../common/metrics/metrics.service";

type ErrorCategory =
  | "validation_error"
  | "rpc_error"
  | "blockchain_error"
  | "signature_error"
  | "unknown_error";

@Injectable()
export class FacilitatorService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metricsService: MetricsService,
  ) {
    this.logger.setContext(FacilitatorService.name);
  }

  private extractPayerFromPayload(
    paymentPayload: PaymentPayload,
  ): string | undefined {
    try {
      // For EVM, payer is in payload.authorization.from
      if (SupportedEVMNetworks.includes(paymentPayload.network)) {
        const evmPayload = paymentPayload.payload as any;
        if (evmPayload?.authorization?.from) {
          return evmPayload.authorization.from;
        }
      }
      // For SVM, we need the response to get payer reliably
      return undefined;
    } catch {
      return undefined;
    }
  }

  private classifyError(error: unknown): {
    category: ErrorCategory;
    message: string;
    reason: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for RPC errors
    if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("network") ||
      errorMessage.includes("timeout")
    ) {
      return {
        category: "rpc_error",
        message: errorMessage,
        reason: "rpc_connection_failed",
      };
    }

    // Check for signature errors
    if (
      errorMessage.includes("signature") ||
      errorMessage.includes("invalid signature") ||
      errorMessage.includes("recovered address")
    ) {
      return {
        category: "signature_error",
        message: errorMessage,
        reason: "signature_verification_failed",
      };
    }

    // Check for blockchain/transaction errors
    if (
      errorMessage.includes("transaction") ||
      errorMessage.includes("insufficient") ||
      errorMessage.includes("balance") ||
      errorMessage.includes("gas") ||
      errorMessage.includes("revert")
    ) {
      return {
        category: "blockchain_error",
        message: errorMessage,
        reason: "blockchain_transaction_failed",
      };
    }

    // Check for validation errors
    if (
      errorMessage.includes("invalid") ||
      errorMessage.includes("network not allowed") ||
      errorMessage.includes("required") ||
      errorMessage.includes("network")
    ) {
      return {
        category: "validation_error",
        message: errorMessage,
        reason: "validation_failed",
      };
    }

    return {
      category: "unknown_error",
      message: errorMessage,
      reason: "unknown_error",
    };
  }

  private extractAmount(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): number {
    try {
      if (SupportedEVMNetworks.includes(paymentPayload.network)) {
        const evmPayload = paymentPayload.payload as any;
        if (evmPayload?.authorization?.value) {
          return parseInt(evmPayload.authorization.value, 10);
        }
      }
      // Fallback to maxAmountRequired if we can't extract from payload
      return parseInt(paymentRequirements.maxAmountRequired, 10);
    } catch {
      return parseInt(paymentRequirements.maxAmountRequired, 10);
    }
  }

  async verifyPayment(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const startTime = Date.now();
    const payer = this.extractPayerFromPayload(paymentPayload);
    const amount = this.extractAmount(paymentPayload, paymentRequirements);
    const { network, scheme } = paymentRequirements;

    let client: Signer | ConnectedClient;
    try {
      if (!this.configService.isNetworkAllowed(paymentRequirements.network)) {
        const errorClass = this.classifyError(new Error("Network not allowed"));
        const duration = (Date.now() - startTime) / 1000;

        this.metricsService.recordPaymentVerification(
          network,
          scheme,
          "failure",
          errorClass.reason,
          duration,
        );

        this.logger.warn(
          {
            network,
            scheme,
            payer: payer || "unknown",
            amount,
            reason: errorClass.reason,
            errorCategory: errorClass.category,
          },
          "Payment verification failed: network not allowed",
        );

        throw new BadRequestException(
          `Network not allowed: ${paymentRequirements.network}`,
        );
      }

      if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
        const x402Config = this.configService.x402Config;
        client = createConnectedClient(paymentRequirements.network, x402Config);
      } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
        const privateKey = this.configService.svmPrivateKey;
        if (!privateKey) {
          const errorClass = this.classifyError(
            new Error("SVM_PRIVATE_KEY is required"),
          );
          const duration = (Date.now() - startTime) / 1000;

          this.metricsService.recordPaymentVerification(
            network,
            scheme,
            "failure",
            errorClass.reason,
            duration,
          );

          throw new BadRequestException(
            "SVM_PRIVATE_KEY is required for SVM network verification",
          );
        }
        client = await createSigner(paymentRequirements.network, privateKey);
      } else {
        const errorClass = this.classifyError(new Error("Invalid network"));
        const duration = (Date.now() - startTime) / 1000;

        this.metricsService.recordPaymentVerification(
          network,
          scheme,
          "failure",
          errorClass.reason,
          duration,
        );

        throw new BadRequestException(
          `Invalid network: ${paymentRequirements.network}`,
        );
      }

      const result = await verify(
        client as any,
        paymentPayload,
        paymentRequirements,
        this.configService.x402Config,
      );

      const duration = (Date.now() - startTime) / 1000;
      const finalPayer = result.payer || payer || "unknown";
      const reason = result.isValid
        ? "none"
        : result.invalidReason || "unknown";

      this.metricsService.recordPaymentVerification(
        network,
        scheme,
        result.isValid ? "success" : "failure",
        reason,
        duration,
      );

      if (result.isValid) {
        this.metricsService.recordPaymentAmount(network, scheme, amount);

        this.logger.info(
          {
            network,
            scheme,
            payer: finalPayer,
            amount,
            duration,
            isValid: true,
          },
          "Payment verification succeeded",
        );
      } else {
        this.logger.warn(
          {
            network,
            scheme,
            payer: finalPayer,
            amount,
            duration,
            isValid: false,
            invalidReason: reason,
          },
          "Payment verification failed",
        );
      }

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorClass = this.classifyError(error);

      if (error instanceof BadRequestException) {
        this.metricsService.recordPaymentVerification(
          network,
          scheme,
          "failure",
          errorClass.reason,
          duration,
        );

        this.logger.warn(
          {
            network,
            scheme,
            payer: payer || "unknown",
            amount,
            duration,
            errorCategory: errorClass.category,
            reason: errorClass.reason,
          },
          "Payment verification failed: validation error",
        );

        throw error;
      }

      this.metricsService.recordPaymentVerification(
        network,
        scheme,
        "failure",
        errorClass.reason,
        duration,
      );

      this.logger.error(
        {
          network,
          scheme,
          payer: payer || "unknown",
          amount,
          duration,
          errorCategory: errorClass.category,
          reason: errorClass.reason,
          error: errorClass.message,
        },
        "Payment verification failed: unexpected error",
      );

      throw new BadRequestException(
        `Verification failed: ${errorClass.message}`,
      );
    }
  }

  async settlePayment(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const startTime = Date.now();
    let confirmationStartTime: number | undefined;
    const payer = this.extractPayerFromPayload(paymentPayload);
    const amount = this.extractAmount(paymentPayload, paymentRequirements);
    const { network, scheme } = paymentRequirements;

    let signer: Signer;
    try {
      if (!this.configService.isNetworkAllowed(paymentRequirements.network)) {
        const errorClass = this.classifyError(new Error("Network not allowed"));
        const duration = (Date.now() - startTime) / 1000;

        this.metricsService.recordPaymentSettlement(
          network,
          scheme,
          "failure",
          errorClass.reason,
          duration,
        );

        this.logger.warn(
          {
            network,
            scheme,
            payer: payer || "unknown",
            amount,
            reason: errorClass.reason,
            errorCategory: errorClass.category,
          },
          "Payment settlement failed: network not allowed",
        );

        throw new BadRequestException(
          `Network not allowed: ${paymentRequirements.network}`,
        );
      }

      if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
        const privateKey = this.configService.evmPrivateKey;
        if (!privateKey) {
          const errorClass = this.classifyError(
            new Error("EVM_PRIVATE_KEY is required"),
          );
          const duration = (Date.now() - startTime) / 1000;

          this.metricsService.recordPaymentSettlement(
            network,
            scheme,
            "failure",
            errorClass.reason,
            duration,
          );

          throw new BadRequestException(
            "EVM_PRIVATE_KEY is required for EVM network settlement",
          );
        }
        const x402Config = this.configService.x402Config;
        signer = await createSigner(
          paymentRequirements.network,
          privateKey,
          x402Config,
        );
      } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
        const privateKey = this.configService.svmPrivateKey;
        if (!privateKey) {
          const errorClass = this.classifyError(
            new Error("SVM_PRIVATE_KEY is required"),
          );
          const duration = (Date.now() - startTime) / 1000;

          this.metricsService.recordPaymentSettlement(
            network,
            scheme,
            "failure",
            errorClass.reason,
            duration,
          );

          throw new BadRequestException(
            "SVM_PRIVATE_KEY is required for SVM network settlement",
          );
        }
        signer = await createSigner(paymentRequirements.network, privateKey);
      } else {
        const errorClass = this.classifyError(new Error("Invalid network"));
        const duration = (Date.now() - startTime) / 1000;

        this.metricsService.recordPaymentSettlement(
          network,
          scheme,
          "failure",
          errorClass.reason,
          duration,
        );

        throw new BadRequestException(
          `Invalid network: ${paymentRequirements.network}`,
        );
      }

      // Track settlement time (settlement includes confirmation wait)
      confirmationStartTime = Date.now();
      const result = await settle(
        signer,
        paymentPayload,
        paymentRequirements,
        this.configService.x402Config,
      );
      const settlementEndTime = Date.now();
      const duration = (settlementEndTime - startTime) / 1000;
      const confirmationWait =
        confirmationStartTime !== undefined
          ? (settlementEndTime - confirmationStartTime) / 1000
          : undefined;

      const finalPayer = result.payer || payer || "unknown";
      const reason = result.success ? "none" : result.errorReason || "unknown";

      this.metricsService.recordPaymentSettlement(
        network,
        scheme,
        result.success ? "success" : "failure",
        reason,
        duration,
        confirmationWait,
      );

      if (result.success) {
        this.metricsService.recordPaymentAmount(network, scheme, amount);

        this.logger.info(
          {
            network,
            scheme,
            payer: finalPayer,
            amount,
            transaction: result.transaction,
            duration,
            confirmationWait,
          },
          "Payment settled successfully",
        );
      } else {
        this.logger.warn(
          {
            network,
            scheme,
            payer: finalPayer,
            amount,
            duration,
            errorReason: reason,
          },
          "Payment settlement failed",
        );
      }

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorClass = this.classifyError(error);

      if (error instanceof BadRequestException) {
        this.metricsService.recordPaymentSettlement(
          network,
          scheme,
          "failure",
          errorClass.reason,
          duration,
        );

        this.logger.warn(
          {
            network,
            scheme,
            payer: payer || "unknown",
            amount,
            duration,
            errorCategory: errorClass.category,
            reason: errorClass.reason,
          },
          "Payment settlement failed: validation error",
        );

        throw error;
      }

      this.metricsService.recordPaymentSettlement(
        network,
        scheme,
        "failure",
        errorClass.reason,
        duration,
      );

      this.logger.error(
        {
          network,
          scheme,
          payer: payer || "unknown",
          amount,
          duration,
          errorCategory: errorClass.category,
          reason: errorClass.reason,
          error: errorClass.message,
        },
        "Payment settlement failed: unexpected error",
      );

      throw new BadRequestException(`Settlement failed: ${errorClass.message}`);
    }
  }

  async getSupportedPaymentKinds(): Promise<{ kinds: SupportedPaymentKind[] }> {
    const kinds: SupportedPaymentKind[] = [];

    // Add EVM network if private key is available
    if (this.configService.evmPrivateKey) {
      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
      });
    }

    // Add SVM network if private key is available
    if (this.configService.svmPrivateKey) {
      try {
        const signer = await createSigner(
          "solana-devnet",
          this.configService.svmPrivateKey!,
        );
        const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

        kinds.push({
          x402Version: 1,
          scheme: "exact",
          network: "solana-devnet",
          extra: feePayer
            ? {
                feePayer,
              }
            : undefined,
        });
      } catch (error) {
        // If signer creation fails, skip SVM
        this.logger.warn(
          { error: error instanceof Error ? error.message : "Unknown error" },
          "Failed to create SVM signer for /supported endpoint",
        );
      }
    }

    return { kinds };
  }
}
