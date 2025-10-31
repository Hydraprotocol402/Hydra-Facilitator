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

  get evmRpcUrl(): string | undefined {
    return this.nestConfigService.get<string>("EVM_RPC_URL");
  }

  get port(): number {
    return this.nestConfigService.get<number>("PORT", 3000);
  }

  get corsOrigins(): string[] {
    const origins = this.nestConfigService.get<string>("CORS_ORIGINS");
    if (!origins) {
      return [];
    }
    return origins.split(",").map((origin) => origin.trim());
  }

  get enableCors(): boolean {
    return this.nestConfigService.get<boolean>("ENABLE_CORS", true);
  }

  get rateLimitTtl(): number {
    return this.nestConfigService.get<number>("RATE_LIMIT_TTL", 60);
  }

  get rateLimitVerify(): number {
    return this.nestConfigService.get<number>("RATE_LIMIT_VERIFY", 100);
  }

  get rateLimitSettle(): number {
    return this.nestConfigService.get<number>("RATE_LIMIT_SETTLE", 50);
  }

  get rateLimitSupported(): number {
    return this.nestConfigService.get<number>("RATE_LIMIT_SUPPORTED", 200);
  }

  get allowedNetworks(): Set<string> | undefined {
    const raw = this.nestConfigService.get<string>("ALLOWED_NETWORKS");
    if (!raw) return undefined;
    return new Set(
      raw
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    );
  }

  isNetworkAllowed(network: string): boolean {
    const list = this.allowedNetworks;
    return !list || list.has(network);
  }

  validate(): void {
    if (!this.evmPrivateKey && !this.svmPrivateKey) {
      throw new Error(
        "At least one of EVM_PRIVATE_KEY or SVM_PRIVATE_KEY must be set",
      );
    }
  }

  get x402Config(): X402Config | undefined {
    const config: X402Config = {};

    if (this.evmRpcUrl) {
      config.evmConfig = { rpcUrl: this.evmRpcUrl };
    }

    if (this.svmRpcUrl) {
      config.svmConfig = { rpcUrl: this.svmRpcUrl };
    }

    return Object.keys(config).length > 0 ? config : undefined;
  }
}
