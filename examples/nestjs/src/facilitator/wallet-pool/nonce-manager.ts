import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import type { Address, Chain, Transport, PublicClient } from "viem";
import type { NonceResult } from "./types";

/**
 * Manages nonces for multiple facilitator wallets.
 * Each wallet maintains its own nonce counter to prevent collisions.
 */
@Injectable()
export class NonceManager {
  private readonly nonces: Map<Address, number> = new Map();
  private readonly locks: Map<Address, Promise<void>> = new Map();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(NonceManager.name);
  }

  /**
   * Gets the next available nonce for a wallet, incrementing the counter.
   * If no cached nonce exists, fetches from blockchain.
   */
  async getNextNonce(
    walletAddress: Address,
    client: PublicClient<Transport, Chain>,
  ): Promise<NonceResult> {
    // Ensure sequential access per wallet
    const currentLock = this.locks.get(walletAddress);
    if (currentLock) {
      await currentLock;
    }

    let resolveNonceLock: () => void;
    const nonceLock = new Promise<void>((resolve) => {
      resolveNonceLock = resolve;
    });
    this.locks.set(walletAddress, nonceLock);

    try {
      const cachedNonce = this.nonces.get(walletAddress);

      if (cachedNonce !== undefined) {
        const nextNonce = cachedNonce;
        this.nonces.set(walletAddress, cachedNonce + 1);

        this.logger.debug(
          {
            walletAddress,
            nonce: nextNonce,
            source: "cache",
          },
          "Retrieved nonce from cache",
        );

        return { nonce: nextNonce, source: "cache" };
      }

      // Fetch from blockchain
      const onChainNonce = await client.getTransactionCount({
        address: walletAddress,
        blockTag: "pending",
      });

      this.nonces.set(walletAddress, onChainNonce + 1);

      this.logger.info(
        {
          walletAddress,
          nonce: onChainNonce,
          source: "blockchain",
        },
        "Retrieved nonce from blockchain",
      );

      return { nonce: onChainNonce, source: "blockchain" };
    } finally {
      this.locks.delete(walletAddress);
      resolveNonceLock!();
    }
  }

  /**
   * Gets the current nonce without incrementing (for read operations)
   */
  getCurrentNonce(walletAddress: Address): number | undefined {
    return this.nonces.get(walletAddress);
  }

  /**
   * Manually sets the nonce for a wallet (used after successful transaction)
   */
  setNonce(walletAddress: Address, nonce: number): void {
    const current = this.nonces.get(walletAddress);
    // Only update if new nonce is higher (prevents race conditions)
    if (current === undefined || nonce > current) {
      this.nonces.set(walletAddress, nonce);
      this.logger.debug(
        {
          walletAddress,
          previousNonce: current,
          newNonce: nonce,
        },
        "Nonce manually updated",
      );
    }
  }

  /**
   * Resets the nonce for a wallet by fetching from blockchain.
   * Used when a nonce collision is detected.
   */
  async resetNonce(
    walletAddress: Address,
    client: PublicClient<Transport, Chain>,
  ): Promise<number> {
    const onChainNonce = await client.getTransactionCount({
      address: walletAddress,
      blockTag: "pending",
    });

    this.nonces.set(walletAddress, onChainNonce);

    this.logger.info(
      {
        walletAddress,
        nonce: onChainNonce,
      },
      "Nonce reset from blockchain",
    );

    return onChainNonce;
  }

  /**
   * Decrements the nonce for a wallet (used when transaction fails before submission)
   */
  decrementNonce(walletAddress: Address): void {
    const current = this.nonces.get(walletAddress);
    if (current !== undefined && current > 0) {
      this.nonces.set(walletAddress, current - 1);
      this.logger.debug(
        {
          walletAddress,
          previousNonce: current,
          newNonce: current - 1,
        },
        "Nonce decremented",
      );
    }
  }

  /**
   * Initializes nonces for multiple wallets by fetching from blockchain
   */
  async initializeNonces(
    walletAddresses: Address[],
    client: PublicClient<Transport, Chain>,
  ): Promise<void> {
    this.logger.info(
      { walletCount: walletAddresses.length },
      "Initializing nonces for wallet pool",
    );

    const results = await Promise.allSettled(
      walletAddresses.map(async (address) => {
        const nonce = await client.getTransactionCount({
          address,
          blockTag: "pending",
        });
        this.nonces.set(address, nonce);
        return { address, nonce };
      }),
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    this.logger.info(
      {
        successful,
        failed,
        total: walletAddresses.length,
      },
      "Nonce initialization complete",
    );
  }

  /**
   * Clears all cached nonces
   */
  clear(): void {
    this.nonces.clear();
    this.logger.info("All nonces cleared");
  }

  /**
   * Gets a snapshot of all nonces for monitoring
   */
  getAllNonces(): Map<Address, number> {
    return new Map(this.nonces);
  }
}



