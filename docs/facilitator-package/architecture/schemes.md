# Scheme Extension Guide

This guide explains how to add new payment schemes to the facilitator package.

## Overview

Payment schemes define how payments are structured, verified, and settled for different blockchain networks. The facilitator currently supports the "exact" scheme, but the architecture allows adding additional schemes.

## Scheme Structure

A payment scheme consists of:

1. **Verification function**: Validates payment payloads
2. **Settlement function**: Submits payments to the blockchain
3. **Type definitions**: Scheme-specific payload types
4. **Network support**: EVM and/or SVM implementations

## Adding a New Scheme

### Step 1: Create Scheme Directory

Create a new directory in `src/schemes/`:

```
src/schemes/
└── your-scheme/
    ├── evm/
    │   ├── facilitator.ts
    │   └── index.ts
    ├── svm/
    │   ├── facilitator/
    │   │   ├── verify.ts
    │   │   ├── settle.ts
    │   │   └── index.ts
    │   └── index.ts
    └── index.ts
```

### Step 2: Define Types

Add scheme-specific types to `src/types/verify/`:

```typescript
// src/types/verify/yourScheme.ts
import { z } from "zod";

export const YourSchemePayloadSchema = z.object({
  // Define your scheme's payload structure
});

export type YourSchemePayload = z.infer<typeof YourSchemePayloadSchema>;
```

### Step 3: Implement Verification

#### EVM Verification

```typescript
// src/schemes/your-scheme/evm/facilitator.ts
import { ConnectedClient } from "../../../types/shared/evm";
import { PaymentPayload, PaymentRequirements, VerifyResponse } from "../../../types/verify";
import { YourSchemePayload } from "../../../types/verify/yourScheme";

export async function verify(
  client: ConnectedClient,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResponse> {
  const schemePayload = payload.payload as YourSchemePayload;

  // Implement verification logic
  // - Validate payload structure
  // - Verify signatures
  // - Check amounts
  // - Validate expiration
  // - Check balances

  return {
    isValid: true,
    payer: "...",
  };
}
```

#### SVM Verification

```typescript
// src/schemes/your-scheme/svm/facilitator/verify.ts
import { TransactionSigner } from "@solana/kit";
import { PaymentPayload, PaymentRequirements, VerifyResponse } from "../../../../../types/verify";
import { X402Config } from "../../../../../types/config";

export async function verify(
  signer: TransactionSigner,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
  const schemePayload = payload.payload as YourSchemePayload;

  // Implement verification logic
  // - Decode transaction
  // - Validate structure
  // - Simulate transaction
  // - Check amounts

  return {
    isValid: true,
    payer: "...",
  };
}
```

### Step 4: Implement Settlement

#### EVM Settlement

```typescript
// src/schemes/your-scheme/evm/facilitator.ts
import { SignerWallet } from "../../../types/shared/evm";
import { PaymentPayload, PaymentRequirements, SettleResponse } from "../../../types/verify";

export async function settle(
  signer: SignerWallet,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
  // Re-verify payment
  // Submit transaction
  // Wait for confirmation

  return {
    success: true,
    transaction: "0x...",
    network: paymentRequirements.network,
    payer: "...",
  };
}
```

#### SVM Settlement

```typescript
// src/schemes/your-scheme/svm/facilitator/settle.ts
import { TransactionSigner } from "@solana/kit";
import { PaymentPayload, PaymentRequirements, SettleResponse } from "../../../../../types/verify";
import { X402Config } from "../../../../../types/config";

export async function settle(
  signer: TransactionSigner,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<SettleResponse> {
  // Re-verify payment
  // Sign transaction
  // Submit transaction
  // Wait for confirmation

  return {
    success: true,
    transaction: "...",
    network: paymentRequirements.network,
    payer: "...",
  };
}
```

### Step 5: Export Scheme

```typescript
// src/schemes/your-scheme/index.ts
export * as evm from "./evm";
export * as svm from "./svm";

export const SCHEME = "your-scheme";
```

### Step 6: Update Main Router

Update `src/facilitator/facilitator.ts` to include your scheme:

```typescript
import { verify as verifyYourSchemeEvm, settle as settleYourSchemeEvm } from "../schemes/your-scheme/evm";
import { verify as verifyYourSchemeSvm, settle as settleYourSchemeSvm } from "../schemes/your-scheme/svm";

export async function verify(...) {
  if (paymentRequirements.scheme === "your-scheme") {
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      return verifyYourSchemeEvm(...);
    }
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      return verifyYourSchemeSvm(...);
    }
  }
  // ... existing code
}

export async function settle(...) {
  if (paymentRequirements.scheme === "your-scheme") {
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      return settleYourSchemeEvm(...);
    }
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      return settleYourSchemeSvm(...);
    }
  }
  // ... existing code
}
```

### Step 7: Update Type Definitions

Update `src/types/verify/x402Specs.ts` to include your scheme:

```typescript
export const schemes = ["exact", "your-scheme"] as const;

// Add to PaymentPayloadSchema
export const PaymentPayloadSchema = z.object({
  // ...
  payload: z.union([
    ExactEvmPayloadSchema,
    ExactSvmPayloadSchema,
    YourSchemePayloadSchema, // Add your scheme
  ]),
});
```

## Best Practices

### 1. Error Handling

Always return appropriate error reasons:

```typescript
return {
  isValid: false,
  invalidReason: "invalid_your_scheme_payload_signature",
  payer: "...",
};
```

### 2. Re-verification

Always re-verify in settlement functions:

```typescript
export async function settle(...) {
  // Re-verify before settlement
  const verifyResult = await verify(...);
  if (!verifyResult.isValid) {
    return {
      success: false,
      errorReason: "invalid_payment",
      // ...
    };
  }
  // ... settlement logic
}
```

### 3. Type Safety

Use TypeScript types and Zod schemas:

```typescript
// Runtime validation
const payload = YourSchemePayloadSchema.parse(rawPayload);

// Type-safe usage
const typedPayload: YourSchemePayload = payload;
```

### 4. Network Support

Implement network-specific logic:

```typescript
if (SupportedEVMNetworks.includes(network)) {
  // EVM-specific logic
} else if (SupportedSVMNetworks.includes(network)) {
  // SVM-specific logic
}
```

## Testing

Add tests for your scheme:

```typescript
// tests/schemes/your-scheme/evm/facilitator.test.ts
describe("Your Scheme EVM", () => {
  it("should verify valid payments", async () => {
    // Test verification
  });

  it("should settle valid payments", async () => {
    // Test settlement
  });
});
```

## See Also

- [Network Support Guide](./network-support.md) - Adding network support
- [API Reference](../api-reference/schemes.md) - Scheme API documentation
- [Exact Scheme Implementation](../../src/schemes/exact/) - Reference implementation

