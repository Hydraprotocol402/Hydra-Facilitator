# Types

Complete reference for all TypeScript types and interfaces exported by the facilitator package.

## Core Types

### PaymentPayload

The signed payment payload from the client containing transfer parameters and signature.

```typescript
interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: Network;
  payload: ExactEvmPayload | ExactSvmPayload;
}
```

**Fields:**
- **`x402Version`**: `number` - x402 protocol version (currently `1`)
- **`scheme`**: `"exact"` - Payment scheme identifier
- **`network`**: `Network` - Network identifier
- **`payload`**: `ExactEvmPayload | ExactSvmPayload` - Scheme-specific payload

**Schema:**
```106:112:src/types/verify/x402Specs.ts
export const PaymentPayloadSchema = z.object({
  x402Version: z.number().refine(val => x402Versions.includes(val as 1)),
  scheme: z.enum(schemes),
  network: NetworkSchema,
  payload: z.union([ExactEvmPayloadSchema, ExactSvmPayloadSchema]),
});
export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>;
```

### PaymentRequirements

The server's payment requirements that the payload must satisfy.

```typescript
interface PaymentRequirements {
  scheme: "exact";
  network: Network;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema?: Record<string, any>;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, any>;
}
```

**Fields:**
- **`scheme`**: `"exact"` - Payment scheme identifier
- **`network`**: `Network` - Network identifier
- **`maxAmountRequired`**: `string` - Maximum payment amount (in atomic units)
- **`resource`**: `string` - Resource URL
- **`description`**: `string` - Human-readable description
- **`mimeType`**: `string` - MIME type of the resource
- **`outputSchema`** (optional): `Record<string, any>` - Output schema definition
- **`payTo`**: `string` - Recipient address (EVM or SVM address)
- **`maxTimeoutSeconds`**: `number` - Maximum payment validity duration
- **`asset`**: `string` - Asset address (token contract address)
- **`extra`** (optional): `Record<string, any>` - Additional scheme-specific data

**Schema:**
```67:80:src/types/verify/x402Specs.ts
export const PaymentRequirementsSchema = z.object({
  scheme: z.enum(schemes),
  network: NetworkSchema,
  maxAmountRequired: z.string().refine(isInteger),
  resource: z.string().url(),
  description: z.string(),
  mimeType: z.string(),
  outputSchema: z.record(z.any()).optional(),
  payTo: EvmOrSvmAddress,
  maxTimeoutSeconds: z.number().int(),
  asset: mixedAddressOrSvmAddress,
  extra: z.record(z.any()).optional(),
});
export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;
```

### VerifyResponse

Response from payment verification.

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

**Fields:**
- **`isValid`**: `boolean` - Whether the payment is valid
- **`invalidReason`** (optional): `string` - Error reason if invalid
- **`payer`** (optional): `string` - Payer address

**Schema:**
```191:196:src/types/verify/x402Specs.ts
export const VerifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.enum(ErrorReasons).optional(),
  payer: EvmOrSvmAddress.optional(),
});
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;
```

### SettleResponse

Response from payment settlement.

```typescript
interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: Network;
}
```

**Fields:**
- **`success`**: `boolean` - Whether settlement succeeded
- **`errorReason`** (optional): `string` - Error reason if failed
- **`payer`** (optional): `string` - Payer address
- **`transaction`**: `string` - Transaction hash (EVM) or signature (SVM)
- **`network`**: `Network` - Network identifier

**Schema:**
```199:206:src/types/verify/x402Specs.ts
export const SettleResponseSchema = z.object({
  success: z.boolean(),
  errorReason: z.enum(ErrorReasons).optional(),
  payer: EvmOrSvmAddress.optional(),
  transaction: z.string().regex(MixedAddressRegex),
  network: NetworkSchema,
});
export type SettleResponse = z.infer<typeof SettleResponseSchema>;
```

## Scheme-Specific Types

### ExactEvmPayload

EVM-specific payment payload for the "exact" scheme.

```typescript
interface ExactEvmPayload {
  signature: string;
  authorization: ExactEvmPayloadAuthorization;
}
```

**Fields:**
- **`signature`**: `string` - EIP-712 signature (hex string)
- **`authorization`**: `ExactEvmPayloadAuthorization` - Authorization parameters

### ExactEvmPayloadAuthorization

Authorization parameters for EVM payments.

```typescript
interface ExactEvmPayloadAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}
```

**Fields:**
- **`from`**: `string` - Payer address (EVM address)
- **`to`**: `string` - Recipient address (EVM address)
- **`value`**: `string` - Payment amount (in atomic units)
- **`validAfter`**: `string` - Unix timestamp when payment becomes valid
- **`validBefore`**: `string` - Unix timestamp when payment expires
- **`nonce`**: `string` - Unique nonce (64-byte hex string)

**Schema:**
```83:91:src/types/verify/x402Specs.ts
export const ExactEvmPayloadAuthorizationSchema = z.object({
  from: z.string().regex(EvmAddressRegex),
  to: z.string().regex(EvmAddressRegex),
  value: z.string().refine(isInteger).refine(hasMaxLength(EvmMaxAtomicUnits)),
  validAfter: z.string().refine(isInteger),
  validBefore: z.string().refine(isInteger),
  nonce: z.string().regex(HexEncoded64ByteRegex),
});
export type ExactEvmPayloadAuthorization = z.infer<typeof ExactEvmPayloadAuthorizationSchema>;
```

### ExactSvmPayload

SVM-specific payment payload for the "exact" scheme.

```typescript
interface ExactSvmPayload {
  transaction: string;
}
```

**Fields:**
- **`transaction`**: `string` - Base64-encoded Solana transaction

**Schema:**
```100:103:src/types/verify/x402Specs.ts
export const ExactSvmPayloadSchema = z.object({
  transaction: z.string().regex(Base64EncodedRegex),
});
export type ExactSvmPayload = z.infer<typeof ExactSvmPayloadSchema>;
```

## Network Types

### Network

Supported network identifiers.

```typescript
type Network =
  | "abstract"
  | "abstract-testnet"
  | "base"
  | "base-sepolia"
  | "avalanche"
  | "avalanche-fuji"
  | "iotex"
  | "solana"
  | "solana-devnet"
  | "sei"
  | "sei-testnet"
  | "polygon"
  | "polygon-amoy"
  | "peaq";
```

**Schema:**
```3:19:src/types/shared/network.ts
export const NetworkSchema = z.enum([
  "abstract",
  "abstract-testnet",
  "base-sepolia",
  "base",
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "solana-devnet",
  "solana",
  "sei",
  "sei-testnet",
  "polygon",
  "polygon-amoy",
  "peaq",
]);
export type Network = z.infer<typeof NetworkSchema>;
```

## Client Types

### ConnectedClient

Read-only blockchain client for EVM networks.

```typescript
type ConnectedClient = evm.ConnectedClient | svm.SvmConnectedClient;
```

### Signer

Wallet signer for submitting transactions.

```typescript
type Signer = evm.EvmSigner | svm.SvmSigner;
```

## Configuration Types

### X402Config

Configuration options for X402 operations.

```typescript
interface X402Config {
  evmConfig?: EvmConfig;
  svmConfig?: SvmConfig;
}
```

### EvmConfig

EVM-specific configuration.

```typescript
interface EvmConfig {
  rpcUrl?: string;
}
```

### SvmConfig

SVM-specific configuration.

```typescript
interface SvmConfig {
  rpcUrl?: string;
}
```

**Implementation:**
```1:31:src/types/config.ts
/**
 * Configuration options for Solana (SVM) RPC connections.
 */
export interface SvmConfig {
  /**
   * Custom RPC URL for Solana connections.
   * If not provided, defaults to public Solana RPC endpoints based on network.
   */
  rpcUrl?: string;
}

/**
 * Configuration options for EVM RPC connections.
 */
export interface EvmConfig {
  /**
   * Custom RPC URL for EVM connections.
   * If not provided, defaults to the RPC URL from the chain definition.
   */
  rpcUrl?: string;
}

/**
 * Configuration options for X402 client and facilitator operations.
 */
export interface X402Config {
  /** Configuration for EVM operations */
  evmConfig?: EvmConfig;
  /** Configuration for Solana (SVM) operations */
  svmConfig?: SvmConfig;
}
```

## Request/Response Types

### FacilitatorRequest

Request format for facilitator endpoints.

```typescript
interface FacilitatorRequest {
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}
```

### VerifyRequest

Request format for verification endpoint.

```typescript
interface VerifyRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}
```

### SettleRequest

Request format for settlement endpoint.

```typescript
interface SettleRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}
```

### SupportedPaymentKind

Supported payment kind information.

```typescript
interface SupportedPaymentKind {
  x402Version: number;
  scheme: "exact";
  network: Network;
  extra?: Record<string, any>;
}
```

### SupportedPaymentKindsResponse

Response containing supported payment kinds.

```typescript
interface SupportedPaymentKindsResponse {
  kinds: SupportedPaymentKind[];
}
```

## Discovery Types

### DiscoveredResource

Discoverable x402-enabled resource.

```typescript
interface DiscoveredResource {
  resource: string;
  type: "http";
  x402Version: number;
  accepts: PaymentRequirements[];
  lastUpdated: Date;
  metadata?: Record<string, any>;
}
```

### ListDiscoveryResourcesResponse

Response from discovery list endpoint.

```typescript
interface ListDiscoveryResourcesResponse {
  x402Version: number;
  items: DiscoveredResource[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}
```

## Error Reasons

Error reason constants for validation failures:

```typescript
type ErrorReason =
  | "insufficient_funds"
  | "invalid_exact_evm_payload_authorization_valid_after"
  | "invalid_exact_evm_payload_authorization_valid_before"
  | "invalid_exact_evm_payload_authorization_value"
  | "invalid_exact_evm_payload_signature"
  | "invalid_exact_evm_payload_recipient_mismatch"
  | "invalid_exact_svm_payload_transaction"
  | "invalid_exact_svm_payload_transaction_amount_mismatch"
  | "invalid_network"
  | "invalid_payload"
  | "invalid_payment_requirements"
  | "invalid_scheme"
  | "invalid_payment"
  | "payment_expired"
  | "unsupported_scheme"
  | "invalid_x402_version"
  | "invalid_transaction_state"
  | "settle_exact_svm_block_height_exceeded"
  | "settle_exact_svm_transaction_confirmation_timed_out"
  | "unexpected_settle_error"
  | "unexpected_verify_error";
```

## Validation Schemas

All types have corresponding Zod schemas for validation:

- `PaymentPayloadSchema` - Validates payment payloads
- `PaymentRequirementsSchema` - Validates payment requirements
- `VerifyResponseSchema` - Validates verification responses
- `SettleResponseSchema` - Validates settlement responses
- `NetworkSchema` - Validates network identifiers

## Usage Examples

### Type-safe Payment Verification

```typescript
import type { PaymentPayload, PaymentRequirements, VerifyResponse } from "x402-hydra-facilitator/types";
import { PaymentPayloadSchema, PaymentRequirementsSchema } from "x402-hydra-facilitator/types";

// Validate and type-check
const payload = PaymentPayloadSchema.parse(rawPayload);
const requirements = PaymentRequirementsSchema.parse(rawRequirements);

// Type-safe verification
const result: VerifyResponse = await verify(client, payload, requirements);
```

### Type-safe Payment Settlement

```typescript
import type { PaymentPayload, PaymentRequirements, SettleResponse } from "x402-hydra-facilitator/types";

const result: SettleResponse = await settle(signer, payload, requirements);

if (result.success) {
  console.log(`Transaction: ${result.transaction}`);
  console.log(`Network: ${result.network}`);
  console.log(`Payer: ${result.payer}`);
}
```

## See Also

- [Core Functions](./core-functions.md) - Using types with verify() and settle()
- [Client Creation](./client-creation.md) - Client types
- [Configuration](./config.md) - Configuration types
- [Schemes](./schemes.md) - Scheme-specific types

