# Payment Schemes

Payment schemes define how payments are structured and verified for different blockchain networks. The facilitator package currently supports the **"exact"** scheme for both EVM and SVM networks.

## Overview

A payment scheme specifies:
- The structure of payment payloads
- How payments are verified
- How payments are settled on the blockchain
- Network-specific implementation details

## Supported Schemes

### "exact" Scheme

The "exact" scheme requires the payment amount to exactly match the required amount. It supports:

- **EVM Networks**: USDC transfers using `transferWithAuthorization`
- **SVM Networks**: SPL token transfers

## EVM Implementation

The EVM "exact" scheme implementation uses EIP-712 signatures and the `transferWithAuthorization` function for USDC transfers.

### Payload Structure

```typescript
interface ExactEvmPayload {
  signature: string;  // EIP-712 signature (hex)
  authorization: {
    from: string;     // Payer address
    to: string;       // Recipient address
    value: string;    // Payment amount (atomic units)
    validAfter: string;   // Unix timestamp
    validBefore: string;  // Unix timestamp
    nonce: string;        // 64-byte hex nonce
  };
}
```

### Verification Process

1. Validates protocol version and scheme
2. Verifies EIP-712 signature
3. Checks payment expiration (`validAfter` and `validBefore`)
4. Validates payment amount meets requirements
5. Verifies payer has sufficient USDC balance
6. Validates recipient address matches requirements

### Settlement Process

1. Re-verifies payment payload
2. Calls `transferWithAuthorization` on USDC contract
3. Waits for transaction confirmation
4. Returns transaction hash

### Implementation

The EVM "exact" scheme is implemented in:

```1:36:src/schemes/exact/evm/facilitator.ts
import { Account, Address, Chain, getAddress, Hex, parseErc6492Signature, Transport } from "viem";
import { getNetworkId } from "../../../shared";
import { getVersion, getERC20Balance } from "../../../shared/evm";
import {
  usdcABI as abi,
  authorizationTypes,
  config,
  ConnectedClient,
  SignerWallet,
} from "../../../types/shared/evm";
import {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
  ExactEvmPayload,
} from "../../../types/verify";
import { SCHEME } from "..";
```

### Supported Networks

- Base (`base`, `base-sepolia`)
- Polygon (`polygon`, `polygon-amoy`)
- Avalanche (`avalanche`, `avalanche-fuji`)
- Abstract (`abstract`, `abstract-testnet`)
- Sei (`sei`, `sei-testnet`)
- IoTeX (`iotex`)
- Peaq (`peaq`)

## SVM Implementation

The SVM "exact" scheme implementation uses Solana transactions with SPL token transfers.

### Payload Structure

```typescript
interface ExactSvmPayload {
  transaction: string;  // Base64-encoded Solana transaction
}
```

### Verification Process

1. Validates protocol version and scheme
2. Decodes base64 transaction
3. Validates transaction structure:
   - Verifies instruction count and types
   - Validates compute budget instructions
   - Checks for associated token account creation
   - Validates SPL token transfer instruction
4. Signs and simulates transaction
5. Validates payment amount and recipient
6. Checks account balances

### Settlement Process

1. Re-verifies payment payload
2. Signs transaction with signer
3. Submits transaction to Solana network
4. Waits for transaction confirmation
5. Returns transaction signature

### Implementation

The SVM "exact" scheme is implemented in:

```64:80:src/schemes/exact/svm/facilitator/verify.ts
export async function verify(
  signer: TransactionSigner,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
  try {
    // verify that the scheme and network are supported
    verifySchemesAndNetworks(payload, paymentRequirements);

    // decode the base64 encoded transaction
    const svmPayload = payload.payload as ExactSvmPayload;
    const decodedTransaction = decodeTransactionFromPayload(svmPayload);
    const rpc = getRpcClient(paymentRequirements.network, config?.svmConfig?.rpcUrl);

    // perform transaction introspection to validate the transaction structure and details
    await transactionIntrospection(svmPayload, paymentRequirements, config);
```

### Supported Networks

- Solana (`solana`, `solana-devnet`)

## Scheme Routing

The facilitator automatically routes to the correct scheme implementation based on the payment requirements:

```40:70:src/facilitator/facilitator.ts
  // exact scheme
  if (paymentRequirements.scheme === "exact") {
    // evm
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      return verifyExactEvm(
        client as EvmConnectedClient<transport, chain, account>,
        payload,
        paymentRequirements,
      );
    }

    // svm
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      return await verifyExactSvm(
        client as TransactionSigner,
        payload,
        paymentRequirements,
        config,
      );
    }
  }

  // unsupported scheme
  return {
    isValid: false,
    invalidReason: "invalid_scheme",
    payer: SupportedEVMNetworks.includes(paymentRequirements.network)
      ? (payload.payload as ExactEvmPayload).authorization.from
      : "",
  };
}
```

## Error Reasons

Scheme-specific error reasons:

### EVM Errors

- `"invalid_exact_evm_payload_signature"` - Signature verification failed
- `"invalid_exact_evm_payload_authorization_valid_after"` - Invalid `validAfter` timestamp
- `"invalid_exact_evm_payload_authorization_valid_before"` - Invalid `validBefore` timestamp
- `"invalid_exact_evm_payload_authorization_value"` - Payment amount doesn't meet requirements
- `"invalid_exact_evm_payload_recipient_mismatch"` - Recipient address doesn't match requirements

### SVM Errors

- `"invalid_exact_svm_payload_transaction"` - Transaction structure is invalid
- `"invalid_exact_svm_payload_transaction_amount_mismatch"` - Payment amount doesn't match
- `"invalid_exact_svm_payload_transaction_instructions"` - Invalid transaction instructions
- `"invalid_exact_svm_payload_transaction_simulation_failed"` - Transaction simulation failed
- `"settle_exact_svm_block_height_exceeded"` - Transaction block height exceeded
- `"settle_exact_svm_transaction_confirmation_timed_out"` - Transaction confirmation timeout

## Usage Examples

### EVM Payment

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";

// EVM payment payload
const payload: PaymentPayload = {
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

// Verify
const client = createConnectedClient("base-sepolia");
const verifyResult = await verify(client, payload, requirements);

// Settle
if (verifyResult.isValid) {
  const signer = await createSigner("base-sepolia", privateKey);
  const settleResult = await settle(signer, payload, requirements);
}
```

### SVM Payment

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";

// SVM payment payload
const payload: PaymentPayload = {
  x402Version: 1,
  scheme: "exact",
  network: "solana-devnet",
  payload: {
    transaction: "base64encodedtransaction...",
  },
};

// Verify (requires signer for SVM)
const signer = await createSigner("solana-devnet", privateKey);
const verifyResult = await verify(signer, payload, requirements);

// Settle
if (verifyResult.isValid) {
  const settleResult = await settle(signer, payload, requirements);
}
```

## Extending Schemes

The facilitator architecture supports adding new payment schemes. To add a new scheme:

1. Create scheme-specific verification function
2. Create scheme-specific settlement function
3. Update main `verify()` and `settle()` functions to route to new scheme
4. Add scheme-specific types
5. Update network support constants

See [Architecture Documentation](../architecture/schemes.md) for detailed extension guide.

## See Also

- [Core Functions](./core-functions.md) - Using schemes with verify() and settle()
- [Types](./types.md) - Scheme-specific types
- [EVM Networks Guide](../guides/evm-networks.md) - EVM-specific guidance
- [SVM Networks Guide](../guides/svm-networks.md) - SVM-specific guidance
- [Architecture Documentation](../architecture/schemes.md) - Scheme extension guide

