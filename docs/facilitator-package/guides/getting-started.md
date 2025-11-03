# Getting Started

This guide walks you through using the facilitator package step-by-step, from installation to verifying and settling your first payment.

## Prerequisites

- Node.js v24 or higher
- pnpm, npm, or yarn
- Basic understanding of TypeScript/JavaScript

## Step 1: Installation

Install the package using your preferred package manager:

```bash
pnpm add x402-hydra-facilitator
# or
npm install x402-hydra-facilitator
# or
yarn add x402-hydra-facilitator
```

See [Installation Guide](../installation.md) for detailed setup instructions.

## Step 2: Basic Setup

Create a new TypeScript file and import the necessary functions:

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";
```

## Step 3: Verify a Payment

Payment verification is read-only and doesn't require a private key for EVM networks.

### Example: EVM Payment Verification

```typescript
// Create a read-only client
const client = createConnectedClient("base-sepolia");

// Payment payload from client (example structure)
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

// Payment requirements from server
const paymentRequirements: PaymentRequirements = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "1000000",
  resource: "https://api.example.com/resource",
  description: "Example resource",
  mimeType: "application/json",
  payTo: "0x...",
  maxTimeoutSeconds: 300,
  asset: "0x...", // USDC contract address
};

// Verify the payment
const result = await verify(client, paymentPayload, paymentRequirements);

if (result.isValid) {
  console.log(`Payment valid from ${result.payer}`);
} else {
  console.error(`Payment invalid: ${result.invalidReason}`);
}
```

## Step 4: Settle a Payment

Payment settlement requires a private key and submits the transaction to the blockchain.

### Example: EVM Payment Settlement

```typescript
// First verify the payment
const verifyResult = await verify(client, paymentPayload, paymentRequirements);

if (!verifyResult.isValid) {
  throw new Error(`Payment verification failed: ${verifyResult.invalidReason}`);
}

// Create signer with private key (keep this secure!)
const privateKey = "0x..."; // Your private key
const signer = await createSigner("base-sepolia", privateKey);

// Settle the payment
const settleResult = await settle(signer, paymentPayload, paymentRequirements);

if (settleResult.success) {
  console.log(`Payment settled!`);
  console.log(`Transaction: ${settleResult.transaction}`);
  console.log(`Network: ${settleResult.network}`);
  console.log(`Payer: ${settleResult.payer}`);
} else {
  console.error(`Settlement failed: ${settleResult.errorReason}`);
}
```

## Step 5: Complete Flow Example

Here's a complete example combining verification and settlement:

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

async function processPayment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  privateKey: string,
) {
  try {
    // Step 1: Verify payment
    const client = createConnectedClient(paymentRequirements.network);
    const verifyResult = await verify(client, paymentPayload, paymentRequirements);

    if (!verifyResult.isValid) {
      return {
        success: false,
        error: `Verification failed: ${verifyResult.invalidReason}`,
      };
    }

    console.log(`Payment verified from ${verifyResult.payer}`);

    // Step 2: Settle payment
    const signer = await createSigner(paymentRequirements.network, privateKey);
    const settleResult = await settle(signer, paymentPayload, paymentRequirements);

    if (!settleResult.success) {
      return {
        success: false,
        error: `Settlement failed: ${settleResult.errorReason}`,
      };
    }

    return {
      success: true,
      transaction: settleResult.transaction,
      network: settleResult.network,
      payer: settleResult.payer,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## Step 6: Error Handling

Always handle errors appropriately:

```typescript
try {
  const result = await verify(client, paymentPayload, paymentRequirements);

  if (!result.isValid) {
    // Handle specific error reasons
    switch (result.invalidReason) {
      case "insufficient_funds":
        console.error("Payer doesn't have enough balance");
        break;
      case "payment_expired":
        console.error("Payment has expired");
        break;
      case "invalid_exact_evm_payload_signature":
        console.error("Invalid signature");
        break;
      default:
        console.error(`Verification failed: ${result.invalidReason}`);
    }
    return;
  }

  // Payment is valid, proceed with settlement
  const settleResult = await settle(signer, paymentPayload, paymentRequirements);

  if (!settleResult.success) {
    console.error(`Settlement failed: ${settleResult.errorReason}`);
    return;
  }

  console.log("Payment processed successfully!");
} catch (error) {
  console.error("Unexpected error:", error);
}
```

## Next Steps

- [Verification Guide](./verification.md) - Detailed verification guide
- [Settlement Guide](./settlement.md) - Detailed settlement guide
- [EVM Networks Guide](./evm-networks.md) - Working with EVM networks
- [SVM Networks Guide](./svm-networks.md) - Working with SVM networks
- [Error Handling Guide](./error-handling.md) - Error handling patterns
- [API Reference](../api-reference/core-functions.md) - Complete API documentation

## Common Issues

### "Unsupported network" Error

Make sure you're using a supported network identifier:
- EVM: `"base"`, `"base-sepolia"`, `"polygon"`, etc.
- SVM: `"solana"`, `"solana-devnet"`

### "Invalid signature" Error

Ensure the payment payload signature is valid and matches the authorization parameters.

### "Insufficient funds" Error

Verify the payer has enough balance in the specified asset (e.g., USDC).

## See Also

- [Installation Guide](../installation.md) - Installation instructions
- [Examples](../examples/) - Complete code examples
- [API Reference](../api-reference/) - Full API documentation

