# Payment Verification

This guide covers payment verification in detail, including verification process, error handling, and best practices.

## Overview

Payment verification validates that a client's payment payload meets the server's payment requirements without submitting a transaction to the blockchain. This allows servers to confirm payment validity before fulfilling requests.

## Verification Process

The verification process includes:

1. **Protocol Validation**: Checks x402 protocol version compatibility
2. **Scheme Validation**: Verifies the payment scheme is supported
3. **Network Validation**: Ensures the network is supported
4. **Signature Verification**: Validates cryptographic signatures
5. **Amount Validation**: Confirms payment amount meets requirements
6. **Expiration Check**: Verifies payment hasn't expired
7. **Balance Check**: Ensures payer has sufficient funds (EVM networks)

## Basic Usage

### EVM Networks

For EVM networks, verification uses a read-only client:

```typescript
import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Create read-only client
const client = createConnectedClient("base-sepolia");

// Verify payment
const result = await verify(client, paymentPayload, paymentRequirements);

if (result.isValid) {
  // Payment is valid, proceed with fulfillment
  console.log(`Payment verified from ${result.payer}`);
} else {
  // Payment is invalid
  console.error(`Verification failed: ${result.invalidReason}`);
}
```

### SVM Networks

For SVM networks, verification requires a signer (transaction simulation):

```typescript
import { verify } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Create signer (required for SVM verification)
const signer = await createSigner("solana-devnet", privateKey);

// Verify payment
const result = await verify(signer, paymentPayload, paymentRequirements);

if (result.isValid) {
  console.log(`Payment verified from ${result.payer}`);
} else {
  console.error(`Verification failed: ${result.invalidReason}`);
}
```

## Verification Response

The `verify()` function returns a `VerifyResponse`:

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

### Response Fields

- **`isValid`**: `boolean` - Whether the payment is valid
- **`invalidReason`** (optional): `string` - Error reason if invalid
- **`payer`** (optional): `string` - Payer address (available when valid or for EVM)

## Error Handling

### Common Error Reasons

#### Protocol Errors

- `"invalid_x402_version"` - Unsupported x402 protocol version
- `"invalid_scheme"` - Unsupported payment scheme
- `"invalid_network"` - Unsupported network

#### Payment Errors

- `"payment_expired"` - Payment deadline has passed
- `"insufficient_funds"` - Payer doesn't have enough balance
- `"invalid_payment"` - Payment doesn't meet requirements

#### Signature Errors

- `"invalid_exact_evm_payload_signature"` - EVM signature verification failed
- `"invalid_exact_svm_payload_transaction"` - SVM transaction validation failed

#### Amount Errors

- `"invalid_exact_evm_payload_authorization_value"` - Payment amount doesn't meet requirements
- `"invalid_exact_svm_payload_transaction_amount_mismatch"` - Amount mismatch

### Error Handling Pattern

```typescript
async function verifyPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<{ success: boolean; error?: string; payer?: string }> {
  try {
    const client = createConnectedClient(requirements.network);
    const result = await verify(client, payload, requirements);

    if (!result.isValid) {
      // Handle specific error reasons
      const errorMessage = getErrorMessage(result.invalidReason);
      return {
        success: false,
        error: errorMessage,
        payer: result.payer,
      };
    }

    return {
      success: true,
      payer: result.payer,
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
    case "insufficient_funds":
      return "Insufficient funds in payer account";
    case "payment_expired":
      return "Payment has expired";
    case "invalid_exact_evm_payload_signature":
      return "Invalid payment signature";
    case "invalid_scheme":
      return "Unsupported payment scheme";
    case "invalid_network":
      return "Unsupported network";
    default:
      return `Verification failed: ${reason || "Unknown reason"}`;
  }
}
```

## Verification Checks

### EVM Verification

The EVM verification process checks:

1. **Protocol version**: Must be `1`
2. **Scheme**: Must be `"exact"`
3. **USDC contract**: Validates USDC contract address for the network
4. **EIP-712 signature**: Verifies signature matches authorization parameters
5. **Expiration**: Checks `validAfter` and `validBefore` timestamps
6. **Amount**: Validates payment amount meets `maxAmountRequired`
7. **Balance**: Checks payer has sufficient USDC balance
8. **Recipient**: Validates recipient matches `payTo` address

### SVM Verification

The SVM verification process checks:

1. **Protocol version**: Must be `1`
2. **Scheme**: Must be `"exact"`
3. **Transaction structure**: Validates transaction format
4. **Instructions**: Verifies transaction instructions
5. **Compute budget**: Validates compute budget instructions
6. **Token transfer**: Verifies SPL token transfer instruction
7. **Amount**: Validates payment amount meets requirements
8. **Account creation**: Checks for associated token account creation
9. **Simulation**: Signs and simulates transaction

## Best Practices

### 1. Always Verify Before Settlement

Even though `settle()` re-verifies, it's good practice to verify separately:

```typescript
// Verify first
const verifyResult = await verify(client, payload, requirements);

if (!verifyResult.isValid) {
  return { error: verifyResult.invalidReason };
}

// Then settle
const settleResult = await settle(signer, payload, requirements);
```

### 2. Validate Inputs

Validate payment payloads and requirements before verification:

```typescript
import { PaymentPayloadSchema, PaymentRequirementsSchema } from "x402-hydra-facilitator/types";

try {
  const validatedPayload = PaymentPayloadSchema.parse(rawPayload);
  const validatedRequirements = PaymentRequirementsSchema.parse(rawRequirements);

  const result = await verify(client, validatedPayload, validatedRequirements);
} catch (error) {
  // Handle validation errors
}
```

### 3. Handle Errors Gracefully

Always handle verification errors appropriately:

```typescript
const result = await verify(client, payload, requirements);

if (!result.isValid) {
  // Log error for debugging
  logger.error("Verification failed", {
    reason: result.invalidReason,
    payer: result.payer,
  });

  // Return appropriate error to client
  return {
    status: 402,
    error: result.invalidReason,
  };
}
```

### 4. Use Appropriate Client Type

- **EVM verification**: Use `createConnectedClient()` (read-only)
- **SVM verification**: Use `createSigner()` (transaction signing required)

### 5. Check Expiration

Always check payment expiration before processing:

```typescript
// Check if payment is expired
const now = Math.floor(Date.now() / 1000);
const payload = paymentPayload.payload as ExactEvmPayload;

if (Number(payload.authorization.validBefore) < now) {
  return {
    isValid: false,
    invalidReason: "payment_expired",
  };
}
```

## Network-Specific Considerations

### EVM Networks

- Read-only verification (no private key needed)
- Faster verification (no transaction simulation)
- On-chain balance checks
- EIP-712 signature verification

### SVM Networks

- Signer required for verification
- Transaction simulation for validation
- Account balance checks
- Transaction structure validation

## See Also

- [Settlement Guide](./settlement.md) - Payment settlement guide
- [Core Functions API](../api-reference/core-functions.md) - Complete API reference
- [Error Handling Guide](./error-handling.md) - Error handling patterns
- [EVM Networks Guide](./evm-networks.md) - EVM-specific guidance
- [SVM Networks Guide](./svm-networks.md) - SVM-specific guidance

