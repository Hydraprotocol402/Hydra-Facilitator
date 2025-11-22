import { Injectable, BadRequestException, OnModuleInit, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
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
  isEvmSignerWallet,
  SupportedPaymentKind,
  Signer,
  ConnectedClient,
} from "x402-hydra-facilitator/types";
import { ConfigService } from "../config/config.service";
import { PinoLogger } from "nestjs-pino";
import { MetricsService } from "../common/metrics/metrics.service";
import { DiscoveryService } from "../discovery/discovery.service";
import type { Address } from "viem";

type ErrorCategory =
  | "validation_error"
  | "rpc_error"
  | "blockchain_error"
  | "signature_error"
  | "unknown_error";

@Injectable()
export class FacilitatorService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metricsService: MetricsService,
    @Optional() private readonly discoveryService?: DiscoveryService,
  ) {
    this.logger.setContext(FacilitatorService.name);
  }

  /**
   * Refresh gas balances every 5 minutes using declarative cron pattern.
   * Cron expression runs at 0 seconds of every 5th minute
   */
  @Cron("0 */5 * * * *")
  handleGasBalanceRefresh() {
    this.refreshAllGasBalances().catch((error) => {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to refresh gas balances in scheduled task",
      );
    });
  }

  onModuleInit() {
    // Refresh immediately on startup to populate metrics
    this.refreshAllGasBalances().catch((error) => {
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to refresh gas balances on startup (non-critical)",
      );
    });

    this.logger.info(
      "Scheduled periodic gas balance refresh (every 5 minutes)",
    );
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

  private async checkFacilitatorGasBalance(
    signer: Signer,
    network: string,
  ): Promise<{
    sufficient: boolean;
    balance: bigint;
    threshold: bigint;
    address: string;
  }> {
    const balanceCheckStartTime = Date.now();

    try {
      let address: string;
      let balance: bigint;
      let threshold: bigint;

      if (isEvmSignerWallet(signer)) {
        // For EVM signers, check if it's a LocalAccount or SignerWallet
        const evmSigner = signer as any;
        if (evmSigner.address) {
          // LocalAccount has direct address property
          address = evmSigner.address;
        } else if (evmSigner.account?.address) {
          // SignerWallet has account.address
          address = evmSigner.account.address;
        } else {
          throw new Error("Unable to extract address from EVM signer");
        }

        threshold = this.configService.gasBalanceThresholdEVM;
        const client = createConnectedClient(
          network,
          this.configService.x402Config,
        );
        balance = await (client as any).getBalance({
          address: address as Address,
        });
      } else if (isSvmSignerWallet(signer)) {
        // For Solana signers, address is directly on the signer
        const svmSigner = signer as any;
        address = svmSigner.address;

        threshold = this.configService.gasBalanceThresholdSVM;
        // Use createConnectedClient for SVM to get RPC access
        const client = createConnectedClient(
          network,
          this.configService.x402Config,
        );
        // SVM connected client is actually an RPC client
        const balanceResponse = await (client as any)
          .getBalance(address)
          .send();
        balance = BigInt(balanceResponse.value);
      } else {
        throw new Error(`Unsupported signer type for network: ${network}`);
      }

      const sufficient = balance >= threshold;
      const duration = (Date.now() - balanceCheckStartTime) / 1000;

      // Record metric
      this.metricsService.recordFacilitatorGasBalance(
        network,
        address,
        balance,
      );

      if (!sufficient) {
        this.logger.error(
          {
            network,
            walletAddress: address,
            balance: balance.toString(),
            threshold: threshold.toString(),
            duration,
          },
          "Facilitator gas balance insufficient",
        );
      } else {
        this.logger.info(
          {
            network,
            walletAddress: address,
            balance: balance.toString(),
            threshold: threshold.toString(),
            duration,
          },
          "Facilitator gas balance check passed",
        );
      }

      return { sufficient, balance, threshold, address };
    } catch (error) {
      const duration = (Date.now() - balanceCheckStartTime) / 1000;
      const errorClass = this.classifyError(error);

      this.logger.error(
        {
          network,
          duration,
          errorCategory: errorClass.category,
          error: errorClass.message,
        },
        "Failed to check facilitator gas balance",
      );

      // On RPC error, we still want to fail fast rather than proceed
      // This prevents transactions from failing later with cryptic errors
      throw new BadRequestException(
        `Unable to verify facilitator gas balance: ${errorClass.message}`,
      );
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

      // Check facilitator gas balance before settlement
      const gasBalanceCheck = await this.checkFacilitatorGasBalance(
        signer,
        paymentRequirements.network,
      );

      if (!gasBalanceCheck.sufficient) {
        const duration = (Date.now() - startTime) / 1000;

        this.metricsService.recordPaymentSettlement(
          network,
          scheme,
          "failure",
          "insufficient_facilitator_gas_balance",
          duration,
        );

        this.logger.error(
          {
            network,
            scheme,
            payer: payer || "unknown",
            amount,
            walletAddress: gasBalanceCheck.address,
            balance: gasBalanceCheck.balance.toString(),
            threshold: gasBalanceCheck.threshold.toString(),
            duration,
            errorCategory: "blockchain_error",
            reason: "insufficient_facilitator_gas_balance",
          },
          "Payment settlement blocked: insufficient facilitator gas balance",
        );

        throw new BadRequestException(
          `Facilitator gas balance insufficient for ${network}. Balance: ${gasBalanceCheck.balance.toString()}, Required: ${gasBalanceCheck.threshold.toString()}. Wallet: ${gasBalanceCheck.address}`,
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

        // Auto-register resource in discovery catalog (async, non-blocking)
        if (paymentRequirements.resource && this.discoveryService) {
          // Fire and forget - don't block settlement response
          this.discoveryService
            .registerResource(paymentRequirements, paymentPayload.network)
            .catch((error) => {
              this.logger.warn(
                {
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                  resource: paymentRequirements.resource,
                },
                "Failed to register resource in discovery (non-critical)",
              );
            });
        }
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

    // EVM networks: check each network individually
    if (this.configService.evmPrivateKey) {
      for (const network of SupportedEVMNetworks) {
        if (this.configService.isNetworkAllowed(network)) {
          kinds.push({
            x402Version: 1,
            scheme: "exact",
            network: network,
          });
        }
      }
    }

    // SVM networks: same private key works for all SVM networks
    if (this.configService.svmPrivateKey) {
      try {
        // Create signer once to extract feePayer (same keypair for all SVM networks)
        const signer = await createSigner(
          "solana", // Use any SVM network, they share the same keypair
          this.configService.svmPrivateKey!,
        );
        const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

        // Add each SVM network if allowed
        for (const network of SupportedSVMNetworks) {
          if (this.configService.isNetworkAllowed(network)) {
            kinds.push({
              x402Version: 1,
              scheme: "exact",
              network: network,
              extra: feePayer ? { feePayer } : undefined,
            });
          }
        }
      } catch (error) {
        // If signer creation fails, skip all SVM networks
        this.logger.warn(
          { error: error instanceof Error ? error.message : "Unknown error" },
          "Failed to create SVM signer for /supported endpoint",
        );
      }
    }

    return { kinds };
  }

  /**
   * Refresh gas balance metrics for all configured networks.
   * This method is called periodically to ensure metrics stay current
   * even when no settlement activity occurs.
   *
   * Only checks networks that are actually configured (have private keys
   * and are in the allowed networks list) to minimize RPC costs.
   */
  async refreshAllGasBalances(): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      // Get all configured networks (same logic as getSupportedPaymentKinds)
      const networksToCheck: string[] = [];

      // EVM networks: check each network individually
      if (this.configService.evmPrivateKey) {
        for (const network of SupportedEVMNetworks) {
          if (this.configService.isNetworkAllowed(network)) {
            networksToCheck.push(network);
          }
        }
      }

      // SVM networks: same private key works for all SVM networks
      if (this.configService.svmPrivateKey) {
        for (const network of SupportedSVMNetworks) {
          if (this.configService.isNetworkAllowed(network)) {
            networksToCheck.push(network);
          }
        }
      }

      if (networksToCheck.length === 0) {
        this.logger.debug(
          "No networks configured, skipping gas balance refresh",
        );
        return;
      }

      // Check balance for each network
      // Use Promise.allSettled to continue even if some networks fail
      await Promise.allSettled(
        networksToCheck.map(async (network) => {
          try {
            let signer: Signer;

            // Create signer for the network
            if (SupportedEVMNetworks.includes(network as any)) {
              const privateKey = this.configService.evmPrivateKey;
              if (!privateKey) {
                throw new Error("EVM_PRIVATE_KEY not configured");
              }
              signer = await createSigner(
                network as any,
                privateKey,
                this.configService.x402Config,
              );
            } else if (SupportedSVMNetworks.includes(network as any)) {
              const privateKey = this.configService.svmPrivateKey;
              if (!privateKey) {
                throw new Error("SVM_PRIVATE_KEY not configured");
              }
              signer = await createSigner(network as any, privateKey);
            } else {
              throw new Error(`Unsupported network: ${network}`);
            }

            // Check balance (this also updates the metric)
            await this.checkFacilitatorGasBalance(signer, network);
            successCount++;
          } catch (error) {
            errorCount++;
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            this.logger.warn(
              {
                network,
                error: errorMessage,
              },
              "Failed to refresh gas balance for network",
            );
            // Don't throw - continue with other networks
          }
        }),
      );

      const duration = Date.now() - startTime;

      this.logger.info(
        {
          networksChecked: networksToCheck.length,
          successCount,
          errorCount,
          durationMs: duration,
        },
        "Gas balance refresh completed",
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: duration,
        },
        "Gas balance refresh failed",
      );
      // Don't throw - this is a background task
    }
  }
}
