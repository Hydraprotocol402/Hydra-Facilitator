import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PinoLogger } from "nestjs-pino";
import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  type Address,
  type Hex,
  type Chain,
  type Transport,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { eip712WalletActions } from "viem/zksync";
import { evm } from "x402-hydra-facilitator/types";

// Type for EVM signer wallet (WalletClient with PublicActions)
type EvmSignerWallet = WalletClient<Transport, Chain, Account> & {
  getBalance: PublicClient["getBalance"];
  getTransactionCount: PublicClient["getTransactionCount"];
  waitForTransactionReceipt: PublicClient["waitForTransactionReceipt"];
  verifyTypedData: PublicClient["verifyTypedData"];
};
import { ConfigService } from "../../config/config.service";
import { MetricsService } from "../../common/metrics/metrics.service";
import { NonceManager } from "./nonce-manager";
import { WalletSelector } from "./wallet-selector";
import {
  FacilitatorWallet,
  WalletPoolConfig,
  WalletPoolStatus,
  WalletStatus,
  WalletPoolError,
  PendingTransaction,
} from "./types";

const DEFAULT_POOL_CONFIG: WalletPoolConfig = {
  maxPendingPerWallet: 3,
  minEthBalance: BigInt("10000000000000000"), // 0.01 ETH in wei
  healthCheckIntervalMs: 60000, // 1 minute
  pendingTxTimeoutMs: 300000, // 5 minutes
  selectionStrategy: "hybrid",
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
};

@Injectable()
export class WalletPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly wallets: Map<Address, FacilitatorWallet> = new Map();
  private readonly pendingTransactions: Map<string, PendingTransaction> =
    new Map();
  private config: WalletPoolConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private publicClient: any = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private network: string = "base-sepolia";

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    private readonly metricsService: MetricsService,
    private readonly nonceManager: NonceManager,
    private readonly walletSelector: WalletSelector,
  ) {
    this.logger.setContext(WalletPoolService.name);
    this.config = this.buildConfig();
  }

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  /**
   * Initializes the wallet pool from environment configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const privateKeys = this.configService.evmPrivateKeys;
    if (!privateKeys || privateKeys.length === 0) {
      this.logger.warn(
        "No EVM private keys configured for wallet pool. Using single wallet mode.",
      );
      // Fall back to single wallet if available
      const singleKey = this.configService.evmPrivateKey;
      if (singleKey) {
        await this.initializeWithKeys([singleKey as Hex]);
      }
      return;
    }

    await this.initializeWithKeys(privateKeys as Hex[]);
  }

  /**
   * Initializes the pool with provided private keys
   */
  private async initializeWithKeys(privateKeys: Hex[]): Promise<void> {
    this.logger.info(
      { walletCount: privateKeys.length },
      "Initializing wallet pool",
    );

    // Get network from config or use default
    this.network = this.configService.defaultEvmNetwork || "base-sepolia";

    // Create public client for the network
    const chain = evm.getChainFromNetwork(this.network);
    const rpcUrl = this.configService.evmRpcUrl;

    this.publicClient = createPublicClient({
      chain,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    // Initialize wallets
    const walletAddresses: Address[] = [];

    for (const privateKey of privateKeys) {
      try {
        const account = privateKeyToAccount(privateKey);
        const wallet: FacilitatorWallet = {
          address: account.address,
          privateKey,
          currentNonce: 0,
          pendingTxCount: 0,
          lastUsedAt: 0,
          isHealthy: true,
          ethBalance: BigInt(0),
          pendingTxs: new Map(),
        };
        this.wallets.set(account.address, wallet);
        walletAddresses.push(account.address);
      } catch (error) {
        this.logger.error(
          { error: error instanceof Error ? error.message : "Unknown error" },
          "Failed to initialize wallet from private key",
        );
      }
    }

    if (this.wallets.size === 0) {
      throw new Error("No valid wallets could be initialized");
    }

    // Initialize nonces for all wallets
    await this.nonceManager.initializeNonces(
      walletAddresses,
      this.publicClient,
    );

    // Sync nonces to wallet objects
    for (const [address, wallet] of this.wallets) {
      const nonce = this.nonceManager.getCurrentNonce(address);
      if (nonce !== undefined) {
        wallet.currentNonce = nonce;
      }
    }

    // Run initial health check
    await this.healthCheck();

    this.initialized = true;

    this.logger.info(
      {
        totalWallets: this.wallets.size,
        network: this.network,
        strategy: this.config.selectionStrategy,
      },
      "Wallet pool initialized successfully",
    );
  }

  /**
   * Builds configuration from environment variables
   */
  private buildConfig(): WalletPoolConfig {
    return {
      maxPendingPerWallet:
        this.configService.maxPendingPerWallet ??
        DEFAULT_POOL_CONFIG.maxPendingPerWallet,
      minEthBalance:
        this.configService.gasBalanceThresholdEVM ??
        DEFAULT_POOL_CONFIG.minEthBalance,
      healthCheckIntervalMs:
        this.configService.healthCheckIntervalMs ??
        DEFAULT_POOL_CONFIG.healthCheckIntervalMs,
      pendingTxTimeoutMs:
        this.configService.pendingTxTimeoutMs ??
        DEFAULT_POOL_CONFIG.pendingTxTimeoutMs,
      selectionStrategy:
        this.configService.walletSelectionStrategy ??
        DEFAULT_POOL_CONFIG.selectionStrategy,
      maxRetryAttempts:
        this.configService.maxRetryAttempts ??
        DEFAULT_POOL_CONFIG.maxRetryAttempts,
      retryDelayMs:
        this.configService.retryDelayMs ?? DEFAULT_POOL_CONFIG.retryDelayMs,
    };
  }

  /**
   * Acquires a signer wallet from the pool for transaction submission
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async acquireWallet(network: string): Promise<{
    signer: any;
    wallet: FacilitatorWallet;
    release: (txHash?: string, success?: boolean) => void;
  }> {
    if (!this.initialized || this.wallets.size === 0) {
      throw new WalletPoolError(
        "no_available_wallet",
        "Wallet pool not initialized",
      );
    }

    const selectionResult = this.walletSelector.selectWallet(
      this.wallets,
      this.config,
    );

    if (!selectionResult.wallet) {
      this.metricsService.recordWalletPoolExhaustion(network);
      throw new WalletPoolError(
        "all_wallets_busy",
        selectionResult.reason || "No available wallets",
      );
    }

    const wallet = selectionResult.wallet;

    // Increment pending count
    wallet.pendingTxCount++;
    wallet.lastUsedAt = Date.now();

    // Create signer for the specific network
    const chain = evm.getChainFromNetwork(network);
    const rpcUrl = this.configService.evmRpcUrl;

    const walletClient = createWalletClient({
      chain,
      transport: rpcUrl ? http(rpcUrl) : http(),
      account: privateKeyToAccount(wallet.privateKey),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let signer: any;
    if (evm.isZkStackChain(chain)) {
      signer = walletClient.extend(publicActions).extend(eip712WalletActions());
    } else {
      signer = walletClient.extend(publicActions);
    }

    // Update metrics
    this.metricsService.recordWalletAcquisition(network, wallet.address);

    this.logger.debug(
      {
        walletAddress: wallet.address,
        pendingTxCount: wallet.pendingTxCount,
        network,
      },
      "Wallet acquired from pool",
    );

    // Return release function for cleanup
    const release = (txHash?: string, success?: boolean) => {
      this.releaseWallet(wallet.address, txHash, success);
    };

    return { signer, wallet, release };
  }

  /**
   * Releases a wallet back to the pool after transaction completion
   */
  releaseWallet(
    walletAddress: Address,
    txHash?: string,
    success?: boolean,
  ): void {
    const wallet = this.wallets.get(walletAddress);
    if (!wallet) {
      this.logger.warn(
        { walletAddress },
        "Attempted to release unknown wallet",
      );
      return;
    }

    // Decrement pending count
    wallet.pendingTxCount = Math.max(0, wallet.pendingTxCount - 1);

    // Remove from pending transactions if hash provided
    if (txHash) {
      wallet.pendingTxs.delete(txHash);
      this.pendingTransactions.delete(txHash);
    }

    this.logger.debug(
      {
        walletAddress,
        pendingTxCount: wallet.pendingTxCount,
        txHash,
        success,
      },
      "Wallet released back to pool",
    );
  }

  /**
   * Tracks a pending transaction
   */
  trackPendingTransaction(
    walletAddress: Address,
    txHash: string,
    nonce: number,
  ): void {
    const wallet = this.wallets.get(walletAddress);
    if (!wallet) return;

    const pending: PendingTransaction = {
      txHash,
      walletAddress,
      submittedAt: Date.now(),
      nonce,
      retryCount: 0,
    };

    wallet.pendingTxs.set(txHash, Date.now());
    this.pendingTransactions.set(txHash, pending);

    this.logger.debug(
      {
        walletAddress,
        txHash,
        nonce,
        totalPending: wallet.pendingTxs.size,
      },
      "Transaction tracked as pending",
    );
  }

  /**
   * Checks if an error is a nonce-related error
   */
  isNonceError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const noncePatterns = [
      "nonce too low",
      "nonce too high",
      "replacement transaction underpriced",
      "already known",
      "transaction underpriced",
      "OldNonce",
      "NonceTooLow",
    ];
    return noncePatterns.some((pattern) =>
      message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  /**
   * Resets the nonce for a wallet after a nonce error
   */
  async resetWalletNonce(walletAddress: Address): Promise<number> {
    if (!this.publicClient) {
      throw new Error("Public client not initialized");
    }

    const newNonce = await this.nonceManager.resetNonce(
      walletAddress,
      this.publicClient,
    );

    const wallet = this.wallets.get(walletAddress);
    if (wallet) {
      wallet.currentNonce = newNonce;
    }

    return newNonce;
  }

  /**
   * Runs periodic health check on all wallets
   */
  @Cron("0 */1 * * * *") // Every minute
  async healthCheck(): Promise<void> {
    if (!this.publicClient || this.wallets.size === 0) {
      return;
    }

    const startTime = Date.now();
    let healthyCount = 0;
    let unhealthyCount = 0;

    for (const [address, wallet] of this.wallets) {
      try {
        // Check ETH balance
        const balance = await this.publicClient.getBalance({ address });
        wallet.ethBalance = balance;
        wallet.isHealthy = balance >= this.config.minEthBalance;

        if (wallet.isHealthy) {
          healthyCount++;
        } else {
          unhealthyCount++;
          this.logger.warn(
            {
              walletAddress: address,
              balance: balance.toString(),
              threshold: this.config.minEthBalance.toString(),
            },
            "Wallet has insufficient balance",
          );
        }

        // Update metrics
        this.metricsService.recordFacilitatorGasBalance(
          this.network,
          address,
          balance,
        );

        // Clean up stale pending transactions
        const now = Date.now();
        for (const [txHash, submittedAt] of wallet.pendingTxs) {
          if (now - submittedAt > this.config.pendingTxTimeoutMs) {
            wallet.pendingTxs.delete(txHash);
            wallet.pendingTxCount = Math.max(0, wallet.pendingTxCount - 1);
            this.pendingTransactions.delete(txHash);

            this.logger.warn(
              {
                walletAddress: address,
                txHash,
                age: now - submittedAt,
              },
              "Cleaned up stale pending transaction",
            );
          }
        }

        // Sync nonce if wallet is idle
        if (wallet.pendingTxCount === 0) {
          const onChainNonce = await this.publicClient.getTransactionCount({
            address,
            blockTag: "pending",
          });
          this.nonceManager.setNonce(address, onChainNonce);
          wallet.currentNonce = onChainNonce;
        }
      } catch (error) {
        this.logger.error(
          {
            walletAddress: address,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Health check failed for wallet",
        );
        wallet.isHealthy = false;
        unhealthyCount++;
      }
    }

    const duration = Date.now() - startTime;

    // Record pool metrics
    this.metricsService.recordWalletPoolStatus(
      this.network,
      this.wallets.size,
      healthyCount,
      this.getTotalPendingTxCount(),
    );

    this.logger.info(
      {
        totalWallets: this.wallets.size,
        healthyWallets: healthyCount,
        unhealthyWallets: unhealthyCount,
        durationMs: duration,
      },
      "Wallet pool health check completed",
    );
  }

  /**
   * Gets the total number of pending transactions across all wallets
   */
  private getTotalPendingTxCount(): number {
    let total = 0;
    for (const wallet of this.wallets.values()) {
      total += wallet.pendingTxCount;
    }
    return total;
  }

  /**
   * Gets the current status of the wallet pool
   */
  getPoolStatus(): WalletPoolStatus {
    const walletStatuses: WalletStatus[] = [];
    let healthyCount = 0;
    let unhealthyCount = 0;
    let totalPending = 0;

    for (const wallet of this.wallets.values()) {
      if (wallet.isHealthy) {
        healthyCount++;
      } else {
        unhealthyCount++;
      }
      totalPending += wallet.pendingTxCount;

      walletStatuses.push({
        address: wallet.address,
        isHealthy: wallet.isHealthy,
        pendingTxCount: wallet.pendingTxCount,
        currentNonce: wallet.currentNonce,
        ethBalance: wallet.ethBalance.toString(),
        lastUsedAt: wallet.lastUsedAt,
      });
    }

    return {
      totalWallets: this.wallets.size,
      healthyWallets: healthyCount,
      unhealthyWallets: unhealthyCount,
      totalPendingTxs: totalPending,
      averagePendingPerWallet:
        this.wallets.size > 0 ? totalPending / this.wallets.size : 0,
      wallets: walletStatuses,
    };
  }

  /**
   * Gets all wallet addresses in the pool
   */
  getWalletAddresses(): Address[] {
    return Array.from(this.wallets.keys());
  }

  /**
   * Gets the pool size
   */
  getPoolSize(): number {
    return this.wallets.size;
  }

  /**
   * Checks if the pool is initialized and has wallets
   */
  isPoolAvailable(): boolean {
    return this.initialized && this.wallets.size > 0;
  }

  /**
   * Gets the configuration
   */
  getConfig(): WalletPoolConfig {
    return { ...this.config };
  }
}

