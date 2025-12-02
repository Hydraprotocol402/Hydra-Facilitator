import type { Address, Hex } from "viem";

/**
 * Represents a single facilitator wallet in the pool
 */
export interface FacilitatorWallet {
  /** Wallet address */
  address: Address;
  /** Private key (hex format for EVM) */
  privateKey: Hex;
  /** Current nonce for this wallet */
  currentNonce: number;
  /** Number of pending transactions */
  pendingTxCount: number;
  /** Timestamp of last use */
  lastUsedAt: number;
  /** Whether the wallet is healthy (has sufficient balance) */
  isHealthy: boolean;
  /** Current ETH balance in wei */
  ethBalance: bigint;
  /** Map of pending transaction hashes to their timestamps */
  pendingTxs: Map<string, number>;
}

/**
 * Configuration for the wallet pool
 */
export interface WalletPoolConfig {
  /** Maximum number of pending transactions per wallet before it's skipped */
  maxPendingPerWallet: number;
  /** Minimum ETH balance required (in wei) for a wallet to be considered healthy */
  minEthBalance: bigint;
  /** Interval for health checks in milliseconds */
  healthCheckIntervalMs: number;
  /** Maximum age for pending transactions before considering them stale (ms) */
  pendingTxTimeoutMs: number;
  /** Strategy for selecting wallets */
  selectionStrategy: WalletSelectionStrategy;
  /** Maximum retry attempts for failed transactions */
  maxRetryAttempts: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
}

/**
 * Available wallet selection strategies
 */
export type WalletSelectionStrategy = "round-robin" | "least-pending" | "hybrid";

/**
 * Result of a wallet selection operation
 */
export interface WalletSelectionResult {
  wallet: FacilitatorWallet | null;
  reason?: string;
}

/**
 * Result of a nonce operation
 */
export interface NonceResult {
  nonce: number;
  source: "cache" | "blockchain";
}

/**
 * Transaction tracking information
 */
export interface PendingTransaction {
  txHash: string;
  walletAddress: Address;
  submittedAt: number;
  nonce: number;
  retryCount: number;
}

/**
 * Pool status information for monitoring
 */
export interface WalletPoolStatus {
  totalWallets: number;
  healthyWallets: number;
  unhealthyWallets: number;
  totalPendingTxs: number;
  averagePendingPerWallet: number;
  wallets: WalletStatus[];
}

/**
 * Individual wallet status
 */
export interface WalletStatus {
  address: Address;
  isHealthy: boolean;
  pendingTxCount: number;
  currentNonce: number;
  ethBalance: string;
  lastUsedAt: number;
}

/**
 * Error types for wallet pool operations
 */
export type WalletPoolErrorType =
  | "no_available_wallet"
  | "nonce_collision"
  | "insufficient_balance"
  | "transaction_failed"
  | "all_wallets_busy"
  | "wallet_unhealthy";

/**
 * Custom error for wallet pool operations
 */
export class WalletPoolError extends Error {
  constructor(
    public readonly type: WalletPoolErrorType,
    message: string,
    public readonly walletAddress?: Address,
  ) {
    super(message);
    this.name = "WalletPoolError";
  }
}



