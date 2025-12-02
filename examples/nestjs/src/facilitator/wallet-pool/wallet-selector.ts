import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { Address } from "viem";
import type {
  FacilitatorWallet,
  WalletSelectionResult,
  WalletSelectionStrategy,
  WalletPoolConfig,
} from "./types";

/**
 * Selects wallets from the pool using configurable strategies.
 * Implements round-robin, least-pending, and hybrid selection algorithms.
 */
@Injectable()
export class WalletSelector {
  private currentIndex: number = 0;

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(WalletSelector.name);
  }

  /**
   * Selects an available wallet using the configured strategy
   */
  selectWallet(
    wallets: Map<Address, FacilitatorWallet>,
    config: WalletPoolConfig,
  ): WalletSelectionResult {
    const availableWallets = this.getAvailableWallets(wallets, config);

    if (availableWallets.length === 0) {
      this.logger.warn("No available wallets in pool");
      return {
        wallet: null,
        reason: this.getUnavailableReason(wallets, config),
      };
    }

    let selected: FacilitatorWallet;

    switch (config.selectionStrategy) {
      case "round-robin":
        selected = this.selectRoundRobin(availableWallets);
        break;
      case "least-pending":
        selected = this.selectLeastPending(availableWallets);
        break;
      case "hybrid":
        selected = this.selectHybrid(availableWallets, config);
        break;
      default:
        selected = this.selectRoundRobin(availableWallets);
    }

    this.logger.debug(
      {
        selectedWallet: selected.address,
        strategy: config.selectionStrategy,
        pendingTxCount: selected.pendingTxCount,
        availableCount: availableWallets.length,
      },
      "Wallet selected",
    );

    return { wallet: selected };
  }

  /**
   * Gets wallets that are available for transaction submission
   */
  private getAvailableWallets(
    wallets: Map<Address, FacilitatorWallet>,
    config: WalletPoolConfig,
  ): FacilitatorWallet[] {
    const available: FacilitatorWallet[] = [];

    for (const wallet of wallets.values()) {
      if (this.isWalletAvailable(wallet, config)) {
        available.push(wallet);
      }
    }

    return available;
  }

  /**
   * Checks if a wallet is available for use
   */
  private isWalletAvailable(
    wallet: FacilitatorWallet,
    config: WalletPoolConfig,
  ): boolean {
    // Must be healthy (sufficient balance)
    if (!wallet.isHealthy) {
      return false;
    }

    // Must not exceed max pending transactions
    if (wallet.pendingTxCount >= config.maxPendingPerWallet) {
      return false;
    }

    return true;
  }

  /**
   * Round-robin selection: cycles through wallets sequentially
   */
  private selectRoundRobin(wallets: FacilitatorWallet[]): FacilitatorWallet {
    // Ensure index is within bounds
    if (this.currentIndex >= wallets.length) {
      this.currentIndex = 0;
    }

    const selected = wallets[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % wallets.length;

    return selected;
  }

  /**
   * Least-pending selection: picks wallet with fewest pending transactions
   */
  private selectLeastPending(wallets: FacilitatorWallet[]): FacilitatorWallet {
    return wallets.reduce((min, wallet) => {
      if (wallet.pendingTxCount < min.pendingTxCount) {
        return wallet;
      }
      // Tie-breaker: prefer less recently used
      if (
        wallet.pendingTxCount === min.pendingTxCount &&
        wallet.lastUsedAt < min.lastUsedAt
      ) {
        return wallet;
      }
      return min;
    }, wallets[0]);
  }

  /**
   * Hybrid selection: round-robin with skip if wallet has too many pending txs
   * Falls back to least-pending if all wallets in rotation are busy
   */
  private selectHybrid(
    wallets: FacilitatorWallet[],
    config: WalletPoolConfig,
  ): FacilitatorWallet {
    // Try round-robin first, but skip if wallet is getting busy
    const busyThreshold = Math.max(1, config.maxPendingPerWallet - 1);
    const attemptCount = Math.min(wallets.length, 3); // Try up to 3 wallets in rotation

    for (let i = 0; i < attemptCount; i++) {
      if (this.currentIndex >= wallets.length) {
        this.currentIndex = 0;
      }

      const candidate = wallets[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % wallets.length;

      if (candidate.pendingTxCount < busyThreshold) {
        return candidate;
      }
    }

    // All checked wallets are busy, fall back to least-pending
    return this.selectLeastPending(wallets);
  }

  /**
   * Generates a reason string for why no wallets are available
   */
  private getUnavailableReason(
    wallets: Map<Address, FacilitatorWallet>,
    config: WalletPoolConfig,
  ): string {
    if (wallets.size === 0) {
      return "No wallets configured in pool";
    }

    let unhealthyCount = 0;
    let busyCount = 0;

    for (const wallet of wallets.values()) {
      if (!wallet.isHealthy) {
        unhealthyCount++;
      } else if (wallet.pendingTxCount >= config.maxPendingPerWallet) {
        busyCount++;
      }
    }

    const parts: string[] = [];
    if (unhealthyCount > 0) {
      parts.push(`${unhealthyCount} unhealthy (low balance)`);
    }
    if (busyCount > 0) {
      parts.push(`${busyCount} busy (max pending reached)`);
    }

    return `All ${wallets.size} wallets unavailable: ${parts.join(", ")}`;
  }

  /**
   * Resets the round-robin index
   */
  resetIndex(): void {
    this.currentIndex = 0;
  }
}



