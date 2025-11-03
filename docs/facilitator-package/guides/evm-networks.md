# Working with EVM Networks

This guide covers EVM-specific considerations when using the facilitator package.

## Supported EVM Networks

- **Base**: `base`, `base-sepolia`
- **Polygon**: `polygon`, `polygon-amoy`
- **Avalanche**: `avalanche`, `avalanche-fuji`
- **Abstract**: `abstract`, `abstract-testnet`
- **Sei**: `sei`, `sei-testnet`
- **IoTeX**: `iotex`
- **Peaq**: `peaq`

## Client Creation

### Verification (Read-Only)

For verification, use `createConnectedClient()` which creates a read-only client:

```typescript
import { createConnectedClient } from "x402-hydra-facilitator/shared";

// Create read-only client for verification
const client = createConnectedClient("base-sepolia");

// With custom RPC URL
const config = {
  evmConfig: {
    rpcUrl: "https://custom-rpc.example.com",
  },
};
const clientWithCustomRpc = createConnectedClient("base-sepolia", config);
```

### Settlement (Signer Required)

For settlement, use `createSigner()` with a private key:

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

// Private key must be hex string (0x...)
const privateKey = "0x1234567890abcdef...";
const signer = await createSigner("base-sepolia", privateKey);

// With custom RPC URL
const config = {
  evmConfig: {
    rpcUrl: "https://custom-rpc.example.com",
  },
};
const signerWithCustomRpc = await createSigner("base-sepolia", privateKey, config);
```

## Payment Payload Structure

EVM payments use the "exact" scheme with EIP-712 signatures:

```typescript
interface ExactEvmPayload {
  signature: string;  // EIP-712 signature (hex)
  authorization: {
    from: string;     // Payer address (0x...)
    to: string;       // Recipient address (0x...)
    value: string;     // Payment amount in atomic units
    validAfter: string;   // Unix timestamp (string)
    validBefore: string;  // Unix timestamp (string)
    nonce: string;        // 64-byte hex nonce (0x...)
  };
}
```

## Verification Process

EVM verification checks:

1. **Protocol version**: Must be `1`
2. **Scheme**: Must be `"exact"`
3. **USDC contract**: Validates USDC contract address
4. **EIP-712 signature**: Verifies signature matches authorization
5. **Expiration**: Checks `validAfter` and `validBefore` timestamps
6. **Amount**: Validates payment amount meets requirements
7. **Balance**: Checks payer has sufficient USDC balance
8. **Recipient**: Validates recipient matches `payTo` address

### Example

```typescript
import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

const client = createConnectedClient("base-sepolia");
const result = await verify(client, paymentPayload, paymentRequirements);

if (result.isValid) {
  console.log(`Payment verified from ${result.payer}`);
} else {
  console.error(`Verification failed: ${result.invalidReason}`);
}
```

## Settlement Process

EVM settlement:

1. Re-verifies payment payload
2. Calls `transferWithAuthorization` on USDC contract
3. Waits for transaction confirmation
4. Returns transaction hash

### Example

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";

const signer = await createSigner("base-sepolia", privateKey);
const result = await settle(signer, paymentPayload, paymentRequirements);

if (result.success) {
  // Transaction hash (0x...)
  console.log(`Transaction: ${result.transaction}`);

  // View on block explorer
  const explorerUrl = `https://sepolia.basescan.org/tx/${result.transaction}`;
  console.log(`View: ${explorerUrl}`);
}
```

## USDC Contract Addresses

Different networks use different USDC contract addresses. The facilitator automatically uses the correct address based on the network:

- **Base Sepolia**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Base**: Network-specific USDC address
- **Polygon**: Network-specific USDC address
- Other networks: Network-specific addresses

The contract address can be specified in `paymentRequirements.asset` or `paymentRequirements.extra.asset`.

## Private Key Format

EVM private keys must be hex strings:

```typescript
// Valid format
const privateKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

// Must start with 0x and be 64 hex characters (32 bytes)
```

## Error Handling

### Common EVM Errors

- `"invalid_exact_evm_payload_signature"` - Signature verification failed
- `"invalid_exact_evm_payload_authorization_valid_after"` - Invalid `validAfter`
- `"invalid_exact_evm_payload_authorization_valid_before"` - Invalid `validBefore`
- `"invalid_exact_evm_payload_authorization_value"` - Amount doesn't meet requirements
- `"invalid_exact_evm_payload_recipient_mismatch"` - Recipient mismatch
- `"insufficient_funds"` - Payer doesn't have enough balance

### Error Handling Example

```typescript
const result = await verify(client, payload, requirements);

if (!result.isValid) {
  switch (result.invalidReason) {
    case "insufficient_funds":
      console.error("Payer doesn't have enough USDC");
      break;
    case "invalid_exact_evm_payload_signature":
      console.error("Invalid signature");
      break;
    case "payment_expired":
      console.error("Payment expired");
      break;
    default:
      console.error(`Verification failed: ${result.invalidReason}`);
  }
}
```

## Custom RPC URLs

Use custom RPC URLs for better performance and reliability:

```typescript
import { createConnectedClient } from "x402-hydra-facilitator/shared";
import type { X402Config } from "x402-hydra-facilitator/types";

const config: X402Config = {
  evmConfig: {
    rpcUrl: process.env.EVM_RPC_URL || "https://rpc.example.com",
  },
};

const client = createConnectedClient("base-sepolia", config);
```

## Gas Considerations

When settling payments:

- Gas fees are paid by the facilitator signer
- Transaction confirmation is automatic
- The `settle()` function waits for confirmation

## Network-Specific Notes

### Base Sepolia

- Testnet network
- USDC test tokens available
- Use for development and testing

### Base

- Mainnet network
- Real USDC required
- Production use

### Polygon

- Lower gas fees
- Fast confirmation times
- Good for high-volume applications

### Abstract

- zkStack-based network
- Uses EIP-712 wallet actions
- Special handling for signature verification

## Best Practices

1. **Use testnets for development**: Test on `base-sepolia` or `polygon-amoy` before production
2. **Validate network**: Ensure the network matches your requirements
3. **Check USDC balance**: Verify payer has sufficient balance before settlement
4. **Custom RPC**: Use dedicated RPC endpoints for production
5. **Error handling**: Handle all error cases appropriately

## See Also

- [SVM Networks Guide](./svm-networks.md) - SVM-specific guidance
- [Verification Guide](./verification.md) - General verification guide
- [Settlement Guide](./settlement.md) - General settlement guide
- [Client Creation API](../api-reference/client-creation.md) - Client creation reference

