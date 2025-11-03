# Error Handling

This guide covers error handling patterns and best practices for the facilitator package.

## Error Response Types

### VerifyResponse Errors

When verification fails, `VerifyResponse` includes an `invalidReason`:

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

### SettleResponse Errors

When settlement fails, `SettleResponse` includes an `errorReason`:

```typescript
interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}
```

## Error Categories

### Protocol Errors

Errors related to protocol validation:

- `"invalid_x402_version"` - Unsupported x402 protocol version
- `"invalid_scheme"` - Unsupported payment scheme
- `"invalid_network"` - Unsupported network

### Payment Errors

Errors related to payment validation:

- `"payment_expired"` - Payment deadline has passed
- `"insufficient_funds"` - Payer doesn't have enough balance
- `"invalid_payment"` - Payment doesn't meet requirements
- `"invalid_payload"` - Payment payload is malformed
- `"invalid_payment_requirements"` - Payment requirements are invalid

### Signature Errors

Errors related to signature verification:

#### EVM

- `"invalid_exact_evm_payload_signature"` - Signature verification failed
- `"invalid_exact_evm_payload_authorization_valid_after"` - Invalid `validAfter` timestamp
- `"invalid_exact_evm_payload_authorization_valid_before"` - Invalid `validBefore` timestamp
- `"invalid_exact_evm_payload_authorization_value"` - Payment amount doesn't meet requirements
- `"invalid_exact_evm_payload_recipient_mismatch"` - Recipient address doesn't match

#### SVM

- `"invalid_exact_svm_payload_transaction"` - Transaction structure is invalid
- `"invalid_exact_svm_payload_transaction_amount_mismatch"` - Payment amount doesn't match
- `"invalid_exact_svm_payload_transaction_instructions"` - Invalid transaction instructions
- `"invalid_exact_svm_payload_transaction_simulation_failed"` - Transaction simulation failed

### Transaction Errors

Errors related to transaction submission:

- `"settle_exact_svm_block_height_exceeded"` - SVM transaction block height exceeded
- `"settle_exact_svm_transaction_confirmation_timed_out"` - SVM confirmation timeout
- `"invalid_transaction_state"` - Transaction is in invalid state
- `"unexpected_settle_error"` - Unexpected error during settlement
- `"unexpected_verify_error"` - Unexpected error during verification

## Error Handling Patterns

### Basic Error Handling

```typescript
import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";

const client = createConnectedClient("base-sepolia");
const result = await verify(client, payload, requirements);

if (!result.isValid) {
  // Handle error
  console.error(`Verification failed: ${result.invalidReason}`);
  return;
}

// Payment is valid
console.log(`Payment verified from ${result.payer}`);
```

### Comprehensive Error Handling

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";

async function processPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  privateKey: string,
): Promise<{ success: boolean; error?: string; transaction?: string }> {
  try {
    // Step 1: Verify
    const client = createConnectedClient(requirements.network);
    const verifyResult = await verify(client, payload, requirements);

    if (!verifyResult.isValid) {
      const errorMessage = getErrorMessage(verifyResult.invalidReason);
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Step 2: Settle
    const signer = await createSigner(requirements.network, privateKey);
    const settleResult = await settle(signer, payload, requirements);

    if (!settleResult.success) {
      const errorMessage = getErrorMessage(settleResult.errorReason);
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      transaction: settleResult.transaction,
    };
  } catch (error) {
    // Handle unexpected errors
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function getErrorMessage(reason?: string): string {
  switch (reason) {
    // Protocol errors
    case "invalid_x402_version":
      return "Unsupported x402 protocol version";
    case "invalid_scheme":
      return "Unsupported payment scheme";
    case "invalid_network":
      return "Unsupported network";

    // Payment errors
    case "payment_expired":
      return "Payment has expired";
    case "insufficient_funds":
      return "Insufficient funds in payer account";
    case "invalid_payment":
      return "Payment doesn't meet requirements";

    // Signature errors (EVM)
    case "invalid_exact_evm_payload_signature":
      return "Invalid payment signature";
    case "invalid_exact_evm_payload_authorization_value":
      return "Payment amount doesn't meet requirements";

    // Signature errors (SVM)
    case "invalid_exact_svm_payload_transaction":
      return "Invalid transaction structure";
    case "invalid_exact_svm_payload_transaction_amount_mismatch":
      return "Payment amount doesn't match requirements";

    // Transaction errors
    case "settle_exact_svm_block_height_exceeded":
      return "Transaction block height exceeded";
    case "settle_exact_svm_transaction_confirmation_timed_out":
      return "Transaction confirmation timed out";

    // Generic errors
    case "unexpected_settle_error":
      return "Unexpected error during settlement";
    case "unexpected_verify_error":
      return "Unexpected error during verification";

    default:
      return `Error: ${reason || "Unknown error"}`;
  }
}
```

### Error Classification

```typescript
type ErrorCategory =
  | "protocol_error"
  | "payment_error"
  | "signature_error"
  | "transaction_error"
  | "unknown_error";

function classifyError(reason?: string): ErrorCategory {
  if (!reason) return "unknown_error";

  // Protocol errors
  if (
    reason.includes("invalid_x402_version") ||
    reason.includes("invalid_scheme") ||
    reason.includes("invalid_network")
  ) {
    return "protocol_error";
  }

  // Payment errors
  if (
    reason.includes("payment_expired") ||
    reason.includes("insufficient_funds") ||
    reason.includes("invalid_payment")
  ) {
    return "payment_error";
  }

  // Signature errors
  if (reason.includes("signature") || reason.includes("payload")) {
    return "signature_error";
  }

  // Transaction errors
  if (reason.includes("transaction") || reason.includes("settle")) {
    return "transaction_error";
  }

  return "unknown_error";
}
```

### Retry Logic

For transient errors, implement retry logic:

```typescript
async function verifyWithRetry(
  client: ConnectedClient,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  maxRetries = 3,
): Promise<VerifyResponse> {
  let lastError: VerifyResponse | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await verify(client, payload, requirements);

      if (result.isValid) {
        return result;
      }

      // Don't retry on non-retryable errors
      if (isRetryableError(result.invalidReason)) {
        lastError = result;
        await sleep(1000 * (attempt + 1)); // Exponential backoff
        continue;
      }

      return result;
    } catch (error) {
      lastError = {
        isValid: false,
        invalidReason: "unexpected_verify_error",
        payer: "",
      };
      await sleep(1000 * (attempt + 1));
    }
  }

  return lastError!;
}

function isRetryableError(reason?: string): boolean {
  // Retry on network/transient errors
  return (
    reason === "unexpected_verify_error" ||
    reason === "settle_exact_svm_transaction_confirmation_timed_out"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Best Practices

### 1. Always Check Error Flags

```typescript
// ✅ Good
if (!result.isValid) {
  handleError(result.invalidReason);
}

// ❌ Bad
if (result.invalidReason) {
  handleError(result.invalidReason);
}
```

### 2. Provide User-Friendly Messages

```typescript
function getUserFriendlyMessage(reason?: string): string {
  switch (reason) {
    case "insufficient_funds":
      return "Your account doesn't have enough balance to complete this payment.";
    case "payment_expired":
      return "This payment has expired. Please request a new payment.";
    case "invalid_exact_evm_payload_signature":
      return "Payment signature is invalid. Please try again.";
    default:
      return "Payment verification failed. Please try again.";
  }
}
```

### 3. Log Errors for Debugging

```typescript
if (!result.isValid) {
  logger.error("Payment verification failed", {
    reason: result.invalidReason,
    payer: result.payer,
    network: requirements.network,
    // Don't log sensitive data like private keys
  });
}
```

### 4. Handle Network-Specific Errors

```typescript
if (!result.isValid) {
  if (requirements.network.startsWith("solana")) {
    // Handle SVM-specific errors
    if (result.invalidReason?.includes("simulation")) {
      // Handle simulation errors
    }
  } else {
    // Handle EVM-specific errors
    if (result.invalidReason?.includes("signature")) {
      // Handle signature errors
    }
  }
}
```

## See Also

- [Verification Guide](./verification.md) - Verification error handling
- [Settlement Guide](./settlement.md) - Settlement error handling
- [Core Functions API](../api-reference/core-functions.md) - Error response types

