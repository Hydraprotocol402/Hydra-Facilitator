import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { X402Config } from "x402-hydra-facilitator/types";
import type { WalletSelectionStrategy } from "../facilitator/wallet-pool/types";

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  /**
   * Gets a single EVM private key (legacy support)
   */
  get evmPrivateKey(): string | undefined {
    return this.nestConfigService.get<string>("EVM_PRIVATE_KEY");
  }

  /**
   * Gets all EVM private keys for the wallet pool.
   * Supports comma-separated list in FACILITATOR_WALLETS env var.
   * Falls back to single EVM_PRIVATE_KEY if pool not configured.
   */
  get evmPrivateKeys(): string[] | undefined {
    const walletsEnv = this.nestConfigService.get<string>("FACILITATOR_WALLETS");
    if (walletsEnv) {
      return walletsEnv
        .split(",")
        .map((key) => key.trim())
        .filter((key) => key.length > 0);
    }
    // Fall back to single key
    const singleKey = this.evmPrivateKey;
    return singleKey ? [singleKey] : undefined;
  }

  /**
   * Gets the wallet pool size (for documentation/validation)
   */
  get walletPoolSize(): number {
    const keys = this.evmPrivateKeys;
    return keys ? keys.length : 0;
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

  get rateLimitDiscovery(): number {
    return this.nestConfigService.get<number>("RATE_LIMIT_DISCOVERY", 200);
  }

  get databaseUrl(): string | undefined {
    return this.nestConfigService.get<string>("DATABASE_URL");
  }

  get isDatabaseEnabled(): boolean {
    return !!this.databaseUrl;
  }

  get allowLocalhostResources(): boolean {
    const value = this.nestConfigService.get<string | boolean>(
      "ALLOW_LOCALHOST_RESOURCES",
      "false",
    );
    // Handle string values from environment variables
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
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

  get gasBalanceThresholdEVM(): bigint {
    const threshold = this.nestConfigService.get<string>(
      "GAS_BALANCE_THRESHOLD_EVM",
      "0.01",
    );
    // Convert ETH to wei (18 decimals): 0.01 ETH = 10000000000000000 wei
    return BigInt(Math.round(parseFloat(threshold) * 1e18));
  }

  get gasBalanceThresholdSVM(): bigint {
    const threshold = this.nestConfigService.get<string>(
      "GAS_BALANCE_THRESHOLD_SVM",
      "0.1",
    );
    // Convert SOL to lamports (9 decimals): 0.1 SOL = 100000000 lamports
    return BigInt(Math.round(parseFloat(threshold) * 1e9));
  }

  // ==================== Wallet Pool Configuration ====================

  /**
   * Maximum number of pending transactions per wallet before it's skipped
   */
  get maxPendingPerWallet(): number {
    return this.nestConfigService.get<number>("MAX_PENDING_PER_WALLET", 3);
  }

  /**
   * Health check interval in milliseconds
   */
  get healthCheckIntervalMs(): number {
    return this.nestConfigService.get<number>(
      "HEALTH_CHECK_INTERVAL_MS",
      60000,
    );
  }

  /**
   * Timeout for pending transactions before they're considered stale (ms)
   */
  get pendingTxTimeoutMs(): number {
    return this.nestConfigService.get<number>("PENDING_TX_TIMEOUT_MS", 300000);
  }

  /**
   * Wallet selection strategy: round-robin, least-pending, or hybrid
   */
  get walletSelectionStrategy(): WalletSelectionStrategy {
    const strategy = this.nestConfigService.get<string>(
      "WALLET_SELECTION_STRATEGY",
      "hybrid",
    );
    if (
      strategy === "round-robin" ||
      strategy === "least-pending" ||
      strategy === "hybrid"
    ) {
      return strategy;
    }
    return "hybrid";
  }

  /**
   * Maximum retry attempts for failed transactions
   */
  get maxRetryAttempts(): number {
    return this.nestConfigService.get<number>("MAX_RETRY_ATTEMPTS", 3);
  }

  /**
   * Delay between retries in milliseconds
   */
  get retryDelayMs(): number {
    return this.nestConfigService.get<number>("RETRY_DELAY_MS", 1000);
  }

  /**
   * Default EVM network for wallet pool initialization
   */
  get defaultEvmNetwork(): string {
    return this.nestConfigService.get<string>(
      "DEFAULT_EVM_NETWORK",
      "base-sepolia",
    );
  }

  /**
   * Whether the wallet pool feature is enabled
   */
  get walletPoolEnabled(): boolean {
    const enabled = this.nestConfigService.get<string | boolean>(
      "WALLET_POOL_ENABLED",
      "true",
    );
    if (typeof enabled === "string") {
      return enabled.toLowerCase() === "true";
    }
    return Boolean(enabled);
  }
}
