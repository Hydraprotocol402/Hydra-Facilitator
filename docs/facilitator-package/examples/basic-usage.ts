/**
 * Basic Usage Example
 *
 * This example demonstrates basic payment verification using the facilitator package.
 */

import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

async function verifyPayment() {
  // Create a read-only client for verification
  const client = createConnectedClient("base-sepolia");

  // Payment payload from client
  const paymentPayload: PaymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "base-sepolia",
    payload: {
      signature: "0x...", // EIP-712 signature
      authorization: {
        from: "0x...", // Payer address
        to: "0x...", // Recipient address
        value: "1000000", // Amount in atomic units (6 decimals for USDC)
        validAfter: "1234567890", // Unix timestamp
        validBefore: "1234567899", // Unix timestamp
        nonce: "0x...", // 64-byte hex nonce
      },
    },
  };

  // Payment requirements from server
  const paymentRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "1000000",
    resource: "https://api.example.com/resource",
    description: "Example resource access",
    mimeType: "application/json",
    payTo: "0x...", // Recipient address
    maxTimeoutSeconds: 300,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
  };

  // Verify the payment
  const result = await verify(client, paymentPayload, paymentRequirements);

  if (result.isValid) {
    console.log(`Payment verified from ${result.payer}`);
    return { success: true, payer: result.payer };
  } else {
    console.error(`Verification failed: ${result.invalidReason}`);
    return { success: false, error: result.invalidReason };
  }
}

// Run the example
verifyPayment().catch(console.error);

