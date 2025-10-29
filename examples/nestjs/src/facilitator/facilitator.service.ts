import { Injectable, BadRequestException } from "@nestjs/common";
import { verify, settle } from "x402/facilitator";
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
} from "x402/types";
import { ConfigService } from "../config/config.service";

@Injectable()
export class FacilitatorService {
  constructor(private readonly configService: ConfigService) {}

  async verifyPayment(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    let client: Signer | ConnectedClient;
    try {
      if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
        client = createConnectedClient(paymentRequirements.network);
      } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
        const privateKey = this.configService.svmPrivateKey;
        if (!privateKey) {
          throw new BadRequestException(
            "SVM_PRIVATE_KEY is required for SVM network verification",
          );
        }
        client = await createSigner(paymentRequirements.network, privateKey);
      } else {
        throw new BadRequestException(
          `Invalid network: ${paymentRequirements.network}`,
        );
      }

      return await verify(
        client as any,
        paymentPayload,
        paymentRequirements,
        this.configService.x402Config,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async settlePayment(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    let signer: Signer;
    try {
      if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
        const privateKey = this.configService.evmPrivateKey;
        if (!privateKey) {
          throw new BadRequestException(
            "EVM_PRIVATE_KEY is required for EVM network settlement",
          );
        }
        signer = await createSigner(paymentRequirements.network, privateKey);
      } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
        const privateKey = this.configService.svmPrivateKey;
        if (!privateKey) {
          throw new BadRequestException(
            "SVM_PRIVATE_KEY is required for SVM network settlement",
          );
        }
        signer = await createSigner(paymentRequirements.network, privateKey);
      } else {
        throw new BadRequestException(
          `Invalid network: ${paymentRequirements.network}`,
        );
      }

      return await settle(
        signer,
        paymentPayload,
        paymentRequirements,
        this.configService.x402Config,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Settlement failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
        console.warn(
          "Failed to create SVM signer for /supported endpoint:",
          error,
        );
      }
    }

    return { kinds };
  }
}
