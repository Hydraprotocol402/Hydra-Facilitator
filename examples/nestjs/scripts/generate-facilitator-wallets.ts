#!/usr/bin/env npx ts-node

/**
 * Generates N facilitator wallets for the wallet pool.
 *
 * Usage:
 *   npx ts-node scripts/generate-facilitator-wallets.ts [count]
 *
 * Example:
 *   npx ts-node scripts/generate-facilitator-wallets.ts 20
 *
 * Output:
 *   - Environment variable for FACILITATOR_WALLETS
 *   - List of addresses to fund with ETH
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

interface GeneratedWallet {
  address: string;
  privateKey: string;
}

function generateWallets(count: number): GeneratedWallet[] {
  const wallets: GeneratedWallet[] = [];

  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    wallets.push({
      address: account.address,
      privateKey: privateKey,
    });
  }

  return wallets;
}

function main(): void {
  const args = process.argv.slice(2);
  const count = parseInt(args[0] || "20", 10);

  if (isNaN(count) || count < 1 || count > 1000) {
    console.error("Error: Count must be a number between 1 and 1000");
    process.exit(1);
  }

  console.log(`\n🔑 Generating ${count} facilitator wallets...\n`);

  const wallets = generateWallets(count);

  // Output environment variable
  console.log("=".repeat(80));
  console.log("ENVIRONMENT VARIABLE (add to your .env file):");
  console.log("=".repeat(80));
  console.log(
    `\nFACILITATOR_WALLETS=${wallets.map((w) => w.privateKey).join(",")}\n`,
  );

  // Output individual wallets for reference
  console.log("=".repeat(80));
  console.log("INDIVIDUAL WALLETS (for reference/debugging):");
  console.log("=".repeat(80));
  wallets.forEach((wallet, index) => {
    console.log(`\nWallet #${index + 1}:`);
    console.log(`  Address:     ${wallet.address}`);
    console.log(`  Private Key: ${wallet.privateKey}`);
  });

  // Output addresses to fund
  console.log("\n" + "=".repeat(80));
  console.log("ADDRESSES TO FUND WITH ETH:");
  console.log("=".repeat(80));
  console.log("\nSend ETH to these addresses (minimum 0.01 ETH each):\n");
  wallets.forEach((wallet, index) => {
    console.log(`${index + 1}. ${wallet.address}`);
  });

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY:");
  console.log("=".repeat(80));
  console.log(`\n✅ Generated ${wallets.length} wallets`);
  console.log(
    `💰 Total ETH needed: ~${(wallets.length * 0.01).toFixed(2)} ETH minimum`,
  );
  console.log(`   (Recommended: ${(wallets.length * 0.05).toFixed(2)} ETH for buffer)\n`);

  // Funding script hint
  console.log("=".repeat(80));
  console.log("BATCH FUNDING (optional - for scripts):");
  console.log("=".repeat(80));
  console.log("\nAddresses as JSON array:\n");
  console.log(JSON.stringify(wallets.map((w) => w.address), null, 2));
  console.log();
}

main();



