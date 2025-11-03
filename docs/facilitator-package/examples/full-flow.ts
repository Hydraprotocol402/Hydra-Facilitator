/**
 * Full Flow Example
 *
 * This example demonstrates the complete payment flow: verification followed by settlement.
 */

import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

async function processPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  privateKey: string,
): Promise<{ success: boolean; transaction?: string; error?: string }> {
  try {
    // Step 1: Verify payment
    console.log("Step 1: Verifying payment...");
    const client = createConnectedClient(paymentRequirements.network);
    const verifyResult = await verify(client, paymentPayload, paymentRequirements);

    if (!verifyResult.isValid) {
      console.error(`Verification failed: ${verifyResult.invalidReason}`);
      return {
        success: false,
        error: `Verification failed: ${verifyResult.invalidReason}`,
      };
    }

    console.log(`✓ Payment verified from ${verifyResult.payer}`);

    // Step 2: Settle payment
    console.log("Step 2: Settling payment...");
    const signer = await createSigner(paymentRequirements.network, privateKey);
    const settleResult = await settle(signer, paymentPayload, paymentRequirements);

    if (!settleResult.success) {
      console.error(`Settlement failed: ${settleResult.errorReason}`);
      return {
        success: false,
        error: `Settlement failed: ${settleResult.errorReason}`,
      };
    }

    console.log(`✓ Payment settled!`);
    console.log(`  Transaction: ${settleResult.transaction}`);
    console.log(`  Network: ${settleResult.network}`);
    console.log(`  Payer: ${settleResult.payer}`);

    return {
      success: true,
      transaction: settleResult.transaction,
    };
  } catch (error) {
    console.error("Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Example usage
async function example() {
  const paymentPayload: PaymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      signature: "0x...",
      authorization: {
        from: "0x...",
        to: "0x...",
        value: "1000000",
        validAfter: "1234567890",
        validBefore: "1234567899",
        nonce: "0x...",
      },
    },
  };

  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "1000000",
    resource: "https://api.example.com/resource",
    description: "Example resource",
    mimeType: "application/json",
    payTo: "0x...",
    maxTimeoutSeconds: 300,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  };

  const privateKey = process.env.PRIVATE_KEY || "0x...";

  const result = await processPayment(paymentPayload, paymentRequirements, privateKey);

  if (result.success) {
    console.log(`\n✅ Payment processed successfully!`);
    console.log(`Transaction: ${result.transaction}`);
  } else {
    console.error(`\n❌ Payment processing failed: ${result.error}`);
  }
}

// Run the example
example().catch(console.error);

