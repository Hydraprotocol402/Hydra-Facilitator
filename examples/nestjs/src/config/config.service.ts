import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { X402Config } from "x402/dist/cjs/types";

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  get evmPrivateKey(): string | undefined {
    return this.nestConfigService.get<string>("EVM_PRIVATE_KEY");
  }

  get svmPrivateKey(): string | undefined {
    return this.nestConfigService.get<string>("SVM_PRIVATE_KEY");
  }

  get svmRpcUrl(): string | undefined {
    return this.nestConfigService.get<string>("SVM_RPC_URL");
  }

  get port(): number {
    return this.nestConfigService.get<number>("PORT", 3000);
  }

  validate(): void {
    if (!this.evmPrivateKey && !this.svmPrivateKey) {
      throw new Error(
        "At least one of EVM_PRIVATE_KEY or SVM_PRIVATE_KEY must be set",
      );
    }
  }

  get x402Config(): X402Config | undefined {
    if (this.svmRpcUrl) {
      return {
        svmConfig: {
          rpcUrl: this.svmRpcUrl,
        },
      };
    }
    return undefined;
  }
}
