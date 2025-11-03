# Working with SVM Networks

This guide covers SVM (Solana Virtual Machine) specific considerations when using the facilitator package.

## Supported SVM Networks

- **Solana**: `solana` (mainnet)
- **Solana Devnet**: `solana-devnet` (testnet)

## Client Creation

### Verification (Signer Required)

For SVM networks, verification requires a signer because it simulates transactions:

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

// Private key must be base58 encoded string
const privateKey = "base58encodedprivatekey...";
const signer = await createSigner("solana-devnet", privateKey);

// With custom RPC URL
const config = {
  svmConfig: {
    rpcUrl: "https://custom-solana-rpc.example.com",
  },
};
const signerWithCustomRpc = await createSigner("solana-devnet", privateKey, config);
```

### Settlement (Signer Required)

Settlement also requires a signer:

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

const signer = await createSigner("solana-devnet", privateKey);
const result = await settle(signer, paymentPayload, paymentRequirements);
```

## Payment Payload Structure

SVM payments use the "exact" scheme with base64-encoded Solana transactions:

```typescript
interface ExactSvmPayload {
  transaction: string;  // Base64-encoded Solana transaction
}
```

The transaction contains:
- SPL token transfer instruction
- Compute budget instructions (optional)
- Associated token account creation (if needed)

## Verification Process

SVM verification checks:

1. **Protocol version**: Must be `1`
2. **Scheme**: Must be `"exact"`
3. **Transaction structure**: Validates transaction format
4. **Instructions**: Verifies transaction instructions
   - Compute budget instructions (if present)
   - Associated token account creation (if needed)
   - SPL token transfer instruction
5. **Amount**: Validates payment amount meets requirements
6. **Recipient**: Validates recipient matches `payTo` address
7. **Simulation**: Signs and simulates transaction

### Example

```typescript
import { verify } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Signer required for SVM verification
const signer = await createSigner("solana-devnet", privateKey);
const result = await verify(signer, paymentPayload, paymentRequirements);

if (result.isValid) {
  console.log(`Payment verified from ${result.payer}`);
} else {
  console.error(`Verification failed: ${result.invalidReason}`);
}
```

## Settlement Process

SVM settlement:

1. Re-verifies payment payload
2. Signs transaction with signer
3. Submits transaction to Solana network
4. Waits for confirmation
5. Returns transaction signature

### Example

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";

const signer = await createSigner("solana-devnet", privateKey);
const result = await settle(signer, paymentPayload, paymentRequirements);

if (result.success) {
  // Transaction signature (base58)
  console.log(`Transaction: ${result.transaction}`);

  // View on block explorer
  const explorerUrl = `https://explorer.solana.com/tx/${result.transaction}?cluster=devnet`;
  console.log(`View: ${explorerUrl}`);
}
```

## Private Key Format

SVM private keys must be base58 encoded strings:

```typescript
// Valid format (base58 encoded)
const privateKey = "5KQwrK1x9v8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J";

// Must be base58 encoded, not hex
```

## Transaction Structure

SVM transactions contain:

### Compute Budget Instructions

Optional instructions to set compute units and priority fees:

```typescript
// SetComputeUnitLimit instruction
// SetComputeUnitPrice instruction
```

### Associated Token Account Creation

If the recipient doesn't have an associated token account, the transaction includes a `CreateAssociatedTokenAccount` instruction.

### SPL Token Transfer

The main transfer instruction:

```typescript
// TransferChecked instruction (SPL Token or Token-2022)
```

## Error Handling

### Common SVM Errors

- `"invalid_exact_svm_payload_transaction"` - Transaction structure invalid
- `"invalid_exact_svm_payload_transaction_amount_mismatch"` - Amount mismatch
- `"invalid_exact_svm_payload_transaction_instructions"` - Invalid instructions
- `"invalid_exact_svm_payload_transaction_simulation_failed"` - Simulation failed
- `"settle_exact_svm_block_height_exceeded"` - Block height exceeded
- `"settle_exact_svm_transaction_confirmation_timed_out"` - Confirmation timeout

### Error Handling Example

```typescript
const result = await verify(signer, payload, requirements);

if (!result.isValid) {
  switch (result.invalidReason) {
    case "invalid_exact_svm_payload_transaction":
      console.error("Invalid transaction structure");
      break;
    case "invalid_exact_svm_payload_transaction_amount_mismatch":
      console.error("Payment amount doesn't match requirements");
      break;
    case "invalid_exact_svm_payload_transaction_simulation_failed":
      console.error("Transaction simulation failed");
      break;
    default:
      console.error(`Verification failed: ${result.invalidReason}`);
  }
}
```

## Custom RPC URLs

Use custom RPC URLs for better performance:

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";
import type { X402Config } from "x402-hydra-facilitator/types";

const config: X402Config = {
  svmConfig: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  },
};

const signer = await createSigner("solana-devnet", privateKey, config);
```

## Fee Payer

For SVM networks, the facilitator signer acts as the fee payer. You can get the fee payer address:

```typescript
import { isSvmSignerWallet } from "x402-hydra-facilitator/shared";

if (isSvmSignerWallet(signer)) {
  const feePayer = signer.address;
  console.log(`Fee payer: ${feePayer}`);
}
```

## Network-Specific Notes

### Solana Devnet

- Testnet network
- SPL test tokens available
- Use for development and testing
- Faster confirmation times

### Solana Mainnet

- Production network
- Real SPL tokens required
- Production use
- Longer confirmation times

## Transaction Confirmation

SVM transactions require confirmation:

- The `settle()` function waits for confirmation automatically
- Confirmation timeout can occur if network is slow
- Transaction may need to be resubmitted if confirmation fails

## Best Practices

1. **Use devnet for development**: Test on `solana-devnet` before production
2. **Signer for verification**: Remember that SVM verification requires a signer
3. **Transaction simulation**: Verification simulates transactions, so use appropriate signer
4. **Custom RPC**: Use dedicated RPC endpoints for production
5. **Error handling**: Handle all error cases, especially confirmation timeouts
6. **Fee payer**: Ensure the signer has sufficient SOL for transaction fees

## See Also

- [EVM Networks Guide](./evm-networks.md) - EVM-specific guidance
- [Verification Guide](./verification.md) - General verification guide
- [Settlement Guide](./settlement.md) - General settlement guide
- [Client Creation API](../api-reference/client-creation.md) - Client creation reference

