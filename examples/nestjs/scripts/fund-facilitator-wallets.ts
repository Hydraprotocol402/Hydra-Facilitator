#!/usr/bin/env npx ts-node

/**
 * Funds facilitator wallets from a master wallet.
 *
 * Usage:
 *   npx ts-node scripts/fund-facilitator-wallets.ts [amount_per_wallet_in_eth]
 *
 * Example:
 *   npx ts-node scripts/fund-facilitator-wallets.ts 0.02
 *
 * Requirements:
 *   - EVM_PRIVATE_KEY must be set in .env (master wallet)
 *   - FACILITATOR_WALLETS must be set in .env (comma-separated list)
 *   - DEFAULT_EVM_NETWORK or defaults to base-sepolia
 */

import { config } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";

// Load environment variables
config();

// Configuration
const DEFAULT_AMOUNT_PER_WALLET = "0.02"; // 0.02 ETH per wallet
const MIN_MASTER_BALANCE_BUFFER = "0.01"; // Keep at least 0.01 ETH in master wallet for gas

interface FundingResult {
  address: Address;
  txHash?: string;
  success: boolean;
  error?: string;
  previousBalance: bigint;
  amountSent: bigint;
}

async function main(): Promise<void> {
  console.log("\n💰 Facilitator Wallet Funding Script\n");
  console.log("=".repeat(70));

  // Get configuration from environment
  const masterPrivateKey = process.env.EVM_PRIVATE_KEY as Hex;
  const facilitatorWalletsEnv = process.env.FACILITATOR_WALLETS;
  const networkName = process.env.DEFAULT_EVM_NETWORK || "base-sepolia";
  const rpcUrl = process.env.EVM_RPC_URL;

  // Validate inputs
  if (!masterPrivateKey) {
    console.error("\n❌ Error: EVM_PRIVATE_KEY not set in .env file");
    process.exit(1);
  }

  if (!facilitatorWalletsEnv) {
    console.error("\n❌ Error: FACILITATOR_WALLETS not set in .env file");
    console.error("   Run: pnpm run generate:wallets 10");
    process.exit(1);
  }

  // Parse facilitator wallet private keys
  const facilitatorPrivateKeys = facilitatorWalletsEnv
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0) as Hex[];

  if (facilitatorPrivateKeys.length === 0) {
    console.error("\n❌ Error: No facilitator wallets found in FACILITATOR_WALLETS");
    process.exit(1);
  }

  // Get amount per wallet from command line or use default
  const amountPerWalletEth = process.argv[2] || DEFAULT_AMOUNT_PER_WALLET;
  const amountPerWallet = parseEther(amountPerWalletEth);

  // Get chain configuration
  const chain = networkName === "base" ? base : baseSepolia;

  console.log(`\n📋 Configuration:`);
  console.log(`   Network: ${networkName} (Chain ID: ${chain.id})`);
  console.log(`   Facilitator wallets: ${facilitatorPrivateKeys.length}`);
  console.log(`   Amount per wallet: ${amountPerWalletEth} ETH`);

  // Create clients
  const publicClient = createPublicClient({
    chain,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });

  const masterAccount = privateKeyToAccount(masterPrivateKey);
  const walletClient = createWalletClient({
    chain,
    transport: rpcUrl ? http(rpcUrl) : http(),
    account: masterAccount,
  });

  console.log(`   Master wallet: ${masterAccount.address}`);

  // Get master wallet balance
  const masterBalance = await publicClient.getBalance({
    address: masterAccount.address,
  });

  console.log(`   Master balance: ${formatEther(masterBalance)} ETH`);

  // Get facilitator wallet addresses and their current balances
  const facilitatorWallets: { address: Address; balance: bigint; needsFunding: boolean }[] = [];
  
  console.log("\n📊 Checking facilitator wallet balances...\n");

  for (const privateKey of facilitatorPrivateKeys) {
    const account = privateKeyToAccount(privateKey);
    const balance = await publicClient.getBalance({ address: account.address });
    const needsFunding = balance < amountPerWallet;
    
    facilitatorWallets.push({
      address: account.address,
      balance,
      needsFunding,
    });
  }

  // Display current balances
  console.log("Wallet Address                               | Current Balance | Needs Funding");
  console.log("-".repeat(80));
  
  for (const wallet of facilitatorWallets) {
    const balanceStr = formatEther(wallet.balance).padStart(12);
    const status = wallet.needsFunding ? "✅ Yes" : "⏭️  No (sufficient)";
    console.log(`${wallet.address} | ${balanceStr} ETH | ${status}`);
  }

  // Calculate total needed
  const walletsNeedingFunding = facilitatorWallets.filter((w) => w.needsFunding);
  const totalAmountNeeded = amountPerWallet * BigInt(walletsNeedingFunding.length);
  const bufferAmount = parseEther(MIN_MASTER_BALANCE_BUFFER);
  const totalRequired = totalAmountNeeded + bufferAmount;

  console.log("\n" + "=".repeat(70));
  console.log(`\n📈 Funding Summary:`);
  console.log(`   Wallets needing funding: ${walletsNeedingFunding.length} of ${facilitatorWallets.length}`);
  console.log(`   Amount per wallet: ${amountPerWalletEth} ETH`);
  console.log(`   Total to send: ${formatEther(totalAmountNeeded)} ETH`);
  console.log(`   Gas buffer (keep in master): ${MIN_MASTER_BALANCE_BUFFER} ETH`);
  console.log(`   Total required in master: ${formatEther(totalRequired)} ETH`);
  console.log(`   Master wallet balance: ${formatEther(masterBalance)} ETH`);

  // Check if we have enough
  if (masterBalance < totalRequired) {
    const deficit = totalRequired - masterBalance;
    console.log("\n" + "=".repeat(70));
    console.log("\n❌ INSUFFICIENT FUNDS IN MASTER WALLET\n");
    console.log(`   You need to send at least ${formatEther(deficit)} ETH to:`);
    console.log(`   ${masterAccount.address}`);
    console.log("\n   Get Base Sepolia ETH from:");
    console.log("   • https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    console.log("   • https://faucet.quicknode.com/base/sepolia");
    console.log("");
    process.exit(1);
  }

  if (walletsNeedingFunding.length === 0) {
    console.log("\n✅ All facilitator wallets already have sufficient balance!");
    console.log("   No funding needed.\n");
    process.exit(0);
  }

  // Confirm before proceeding
  console.log("\n" + "=".repeat(70));
  console.log("\n⚠️  Ready to fund wallets. Press Ctrl+C to cancel or wait 5 seconds...\n");
  
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Fund each wallet
  console.log("\n🚀 Starting funding transactions...\n");
  
  const results: FundingResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < walletsNeedingFunding.length; i++) {
    const wallet = walletsNeedingFunding[i];
    const walletNum = i + 1;
    
    console.log(`[${walletNum}/${walletsNeedingFunding.length}] Funding ${wallet.address}...`);
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txHash = await walletClient.sendTransaction({
        to: wallet.address,
        value: amountPerWallet,
      } as any);

      console.log(`   ✅ Transaction sent: ${txHash}`);
      
      // Wait for confirmation
      console.log(`   ⏳ Waiting for confirmation...`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      if (receipt.status === "success") {
        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
        successCount++;
        results.push({
          address: wallet.address,
          txHash,
          success: true,
          previousBalance: wallet.balance,
          amountSent: amountPerWallet,
        });
      } else {
        console.log(`   ❌ Transaction failed`);
        failCount++;
        results.push({
          address: wallet.address,
          txHash,
          success: false,
          error: "Transaction reverted",
          previousBalance: wallet.balance,
          amountSent: BigInt(0),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log(`   ❌ Error: ${errorMessage}`);
      failCount++;
      results.push({
        address: wallet.address,
        success: false,
        error: errorMessage,
        previousBalance: wallet.balance,
        amountSent: BigInt(0),
      });
    }
    
    // Small delay between transactions
    if (i < walletsNeedingFunding.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(70));
  console.log("\n📊 FUNDING COMPLETE\n");
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  const totalSent = results.reduce((sum, r) => sum + r.amountSent, BigInt(0));
  console.log(`   💰 Total ETH sent: ${formatEther(totalSent)} ETH`);

  // Get new master balance
  const newMasterBalance = await publicClient.getBalance({
    address: masterAccount.address,
  });
  console.log(`   💳 New master balance: ${formatEther(newMasterBalance)} ETH`);

  if (failCount > 0) {
    console.log("\n⚠️  Some transactions failed. You may need to retry.");
    process.exit(1);
  }

  console.log("\n✅ All facilitator wallets funded successfully!\n");
  console.log("   You can now start the facilitator server:");
  console.log("   pnpm run start:dev\n");
}

main().catch((error) => {
  console.error("\n❌ Unexpected error:", error.message);
  process.exit(1);
});

