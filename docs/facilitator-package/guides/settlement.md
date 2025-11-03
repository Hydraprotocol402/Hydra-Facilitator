# Payment Settlement

This guide covers payment settlement in detail, including the settlement process, error handling, and best practices.

## Overview

Payment settlement submits a verified payment transaction to the blockchain and waits for confirmation. Settlement requires a private key and actually transfers funds from the payer to the recipient.

## Settlement Process

The settlement process includes:

1. **Re-verification**: Verifies the payment payload again before settlement
2. **Transaction Submission**: Submits the payment transaction to the blockchain
3. **Confirmation**: Waits for blockchain confirmation
4. **Result**: Returns transaction details or error

## Basic Usage

Settlement requires a signer with a private key:

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Create signer with private key
const signer = await createSigner("base-sepolia", privateKey);

// Settle payment
const result = await settle(signer, paymentPayload, paymentRequirements);

if (result.success) {
  console.log(`Payment settled!`);
  console.log(`Transaction: ${result.transaction}`);
  console.log(`Network: ${result.network}`);
  console.log(`Payer: ${result.payer}`);
} else {
  console.error(`Settlement failed: ${result.errorReason}`);
}
```

## Settlement Response

The `settle()` function returns a `SettleResponse`:

```typescript
interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}
```

### Response Fields

- **`success`**: `boolean` - Whether settlement succeeded
- **`errorReason`** (optional): `string` - Error reason if failed
- **`payer`** (optional): `string` - Payer address
- **`transaction`**: `string` - Transaction hash (EVM) or signature (SVM)
- **`network`**: `Network` - Network identifier

## Error Handling

### Common Error Reasons

#### Verification Errors

- `"invalid_payment"` - Payment verification failed during re-verification
- `"payment_expired"` - Payment expired before settlement

#### Network Errors

- `"invalid_network"` - Unsupported network
- `"invalid_scheme"` - Unsupported payment scheme

#### Transaction Errors

- `"settle_exact_svm_block_height_exceeded"` - SVM transaction block height exceeded
- `"settle_exact_svm_transaction_confirmation_timed_out"` - SVM confirmation timeout
- `"unexpected_settle_error"` - Unexpected error during settlement

### Error Handling Pattern

```typescript
async function settlePayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  privateKey: string,
): Promise<{ success: boolean; transaction?: string; error?: string }> {
  try {
    const signer = await createSigner(requirements.network, privateKey);
    const result = await settle(signer, payload, requirements);

    if (!result.success) {
      const errorMessage = getErrorMessage(result.errorReason);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      transaction: result.transaction,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function getErrorMessage(reason?: string): string {
  switch (reason) {
    case "invalid_payment":
      return "Payment verification failed";
    case "payment_expired":
      return "Payment has expired";
    case "settle_exact_svm_block_height_exceeded":
      return "Transaction block height exceeded";
    case "settle_exact_svm_transaction_confirmation_timed_out":
      return "Transaction confirmation timed out";
    default:
      return `Settlement failed: ${reason || "Unknown reason"}`;
  }
}
```

## Settlement Process Details

### EVM Settlement

For EVM networks, settlement:

1. Re-verifies the payment payload
2. Calls `transferWithAuthorization` on the USDC contract
3. Waits for transaction confirmation
4. Returns transaction hash

```typescript
// EVM settlement example
const signer = await createSigner("base-sepolia", evmPrivateKey);
const result = await settle(signer, evmPayload, requirements);

if (result.success) {
  // Transaction hash (0x...)
  console.log(`Transaction: ${result.transaction}`);

  // View on block explorer
  const explorerUrl = `https://sepolia.basescan.org/tx/${result.transaction}`;
  console.log(`View transaction: ${explorerUrl}`);
}
```

### SVM Settlement

For SVM networks, settlement:

1. Re-verifies the payment payload
2. Signs the transaction with the signer
3. Submits transaction to Solana network
4. Waits for confirmation
5. Returns transaction signature

```typescript
// SVM settlement example
const signer = await createSigner("solana-devnet", svmPrivateKey);
const result = await settle(signer, svmPayload, requirements);

if (result.success) {
  // Transaction signature (base58)
  console.log(`Transaction: ${result.transaction}`);

  // View on block explorer
  const explorerUrl = `https://explorer.solana.com/tx/${result.transaction}?cluster=devnet`;
  console.log(`View transaction: ${explorerUrl}`);
}
```

## Best Practices

### 1. Always Verify Before Settling

Even though `settle()` re-verifies, verify separately first:

```typescript
// Step 1: Verify
const client = createConnectedClient(requirements.network);
const verifyResult = await verify(client, payload, requirements);

if (!verifyResult.isValid) {
  throw new Error(`Verification failed: ${verifyResult.invalidReason}`);
}

// Step 2: Settle
const signer = await createSigner(requirements.network, privateKey);
const settleResult = await settle(signer, payload, requirements);
```

### 2. Handle Transaction Confirmations

The `settle()` function waits for confirmation, but you may want additional monitoring:

```typescript
const result = await settle(signer, payload, requirements);

if (result.success) {
  // Transaction is confirmed
  console.log(`Transaction confirmed: ${result.transaction}`);

  // Optional: Additional verification
  // You can verify the transaction on-chain if needed
}
```

### 3. Secure Private Key Handling

Never expose private keys:

```typescript
// ❌ Bad: Exposing private key
console.log(`Using private key: ${privateKey}`);

// ✅ Good: Use environment variables
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY environment variable not set");
}

const signer = await createSigner(network, privateKey);
```

### 4. Error Logging

Log errors for debugging without exposing sensitive data:

```typescript
try {
  const result = await settle(signer, payload, requirements);

  if (!result.success) {
    logger.error("Settlement failed", {
      errorReason: result.errorReason,
      network: result.network,
      payer: result.payer,
      // Don't log private keys or full payloads
    });
  }
} catch (error) {
  logger.error("Settlement error", {
    error: error instanceof Error ? error.message : "Unknown error",
    // Don't log stack traces with sensitive data in production
  });
}
```

### 5. Transaction Monitoring

Monitor settlement transactions:

```typescript
const result = await settle(signer, payload, requirements);

if (result.success) {
  // Store transaction for tracking
  await storeTransaction({
    transactionHash: result.transaction,
    network: result.network,
    payer: result.payer,
    timestamp: new Date(),
  });

  // Optional: Monitor transaction status
  await monitorTransaction(result.transaction, result.network);
}
```

## Network-Specific Considerations

### EVM Networks

- Returns transaction hash (`0x...`)
- Transaction confirmation is automatic
- Can view on block explorers (BaseScan, PolygonScan, etc.)
- Gas fees are paid by the facilitator signer

### SVM Networks

- Returns transaction signature (base58)
- Transaction confirmation is automatic
- Can view on Solana explorers
- Compute units and fees are handled in transaction

## Complete Settlement Flow

Here's a complete example with error handling:

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

async function processPaymentSettlement(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  privateKey: string,
): Promise<{ success: boolean; transaction?: string; error?: string }> {
  try {
    // Step 1: Verify payment
    const client = createConnectedClient(requirements.network);
    const verifyResult = await verify(client, payload, requirements);

    if (!verifyResult.isValid) {
      return {
        success: false,
        error: `Verification failed: ${verifyResult.invalidReason}`,
      };
    }

    // Step 2: Create signer
    const signer = await createSigner(requirements.network, privateKey);

    // Step 3: Settle payment
    const settleResult = await settle(signer, payload, requirements);

    if (!settleResult.success) {
      return {
        success: false,
        error: `Settlement failed: ${settleResult.errorReason}`,
      };
    }

    // Step 4: Return success
    return {
      success: true,
      transaction: settleResult.transaction,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## See Also

- [Verification Guide](./verification.md) - Payment verification guide
- [Core Functions API](../api-reference/core-functions.md) - Complete API reference
- [Error Handling Guide](./error-handling.md) - Error handling patterns
- [EVM Networks Guide](./evm-networks.md) - EVM-specific guidance
- [SVM Networks Guide](./svm-networks.md) - SVM-specific guidance

