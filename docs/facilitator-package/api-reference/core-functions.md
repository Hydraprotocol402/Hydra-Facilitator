# Core Functions

The facilitator package provides two core functions: `verify()` and `settle()`. These functions handle payment verification and settlement for all supported payment schemes and networks.

## verify()

Verifies a payment payload against payment requirements without submitting to the blockchain.

### Signature

```typescript
function verify(
  client: ConnectedClient | Signer,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse>
```

### Parameters

- **`client`**: `ConnectedClient | Signer`
  - For EVM networks: Use `ConnectedClient` (read-only, no private key needed)
  - For SVM networks: Use `Signer` (transaction signing required for verification)
  - Created using `createConnectedClient()` or `createSigner()`

- **`payload`**: `PaymentPayload`
  - The signed payment payload from the client
  - Must match the `scheme` and `network` specified in `paymentRequirements`
  - See [Types Documentation](./types.md) for structure details

- **`paymentRequirements`**: `PaymentRequirements`
  - The server's payment requirements
  - Defines the required amount, recipient, asset, and other payment parameters
  - See [Types Documentation](./types.md) for structure details

- **`config`** (optional): `X402Config`
  - Optional configuration for custom RPC URLs
  - See [Configuration Documentation](./config.md) for details

### Returns

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer: string;
}
```

- **`isValid`**: `boolean` - Whether the payment payload is valid
- **`invalidReason`** (optional): `string` - Error reason if validation failed
- **`payer`**: `string` - The address of the payment sender

### Behavior

The verification process:

1. **Validates protocol version**: Ensures `x402Version` matches supported versions
2. **Validates scheme**: Ensures the payment scheme is supported
3. **Validates network**: Ensures the network is supported
4. **Verifies signature**: Validates the cryptographic signature on the payment payload
5. **Checks payment amount**: Verifies the payment amount meets requirements
6. **Validates expiration**: Ensures the payment hasn't expired
7. **Checks balance**: Verifies the payer has sufficient funds (for EVM networks)

### Example

```typescript
import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Create client (read-only for EVM)
const client = createConnectedClient("base-sepolia");

// Verify payment
const result = await verify(client, paymentPayload, paymentRequirements);

if (result.isValid) {
  console.log(`Payment valid from ${result.payer}`);
} else {
  console.error(`Payment invalid: ${result.invalidReason}`);
}
```

### Error Handling

Common `invalidReason` values:

- `"invalid_scheme"` - Unsupported payment scheme
- `"invalid_network"` - Unsupported network
- `"invalid_x402_version"` - Unsupported x402 protocol version
- `"payment_expired"` - Payment deadline has passed
- `"insufficient_funds"` - Payer doesn't have enough balance
- `"invalid_payload"` - Payment payload is malformed
- `"invalid_exact_evm_payload_signature"` - EVM signature verification failed
- `"invalid_exact_svm_payload_transaction"` - SVM transaction validation failed

See [Error Handling Guide](../guides/error-handling.md) for detailed error handling patterns.

### Network-Specific Notes

#### EVM Networks

- Uses read-only client (`ConnectedClient`)
- No private key required
- Verifies EIP-712 signatures
- Checks on-chain balance

#### SVM Networks

- Requires signer (`Signer`)
- Signs and simulates transactions for verification
- Verifies transaction structure and instructions
- Checks account balances

### Implementation

The function routes to scheme-specific verifiers based on `paymentRequirements.scheme` and `network`:

```30:70:src/facilitator/facilitator.ts
export async function verify<
  transport extends Transport,
  chain extends Chain,
  account extends Account | undefined,
>(
  client: ConnectedClient | Signer,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
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

## settle()

Settles a verified payment on the blockchain by submitting a transaction and waiting for confirmation.

### Signature

```typescript
function settle(
  client: Signer,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<SettleResponse>
```

### Parameters

- **`client`**: `Signer`
  - Wallet signer with private key for submitting transactions
  - Required for both EVM and SVM networks
  - Created using `createSigner()`

- **`payload`**: `PaymentPayload`
  - The signed payment payload from the client
  - Should be verified before settlement

- **`paymentRequirements`**: `PaymentRequirements`
  - The server's payment requirements
  - Must match the verified payment

- **`config`** (optional): `X402Config`
  - Optional configuration for custom RPC URLs
  - See [Configuration Documentation](./config.md) for details

### Returns

```typescript
interface SettleResponse {
  success: boolean;
  transaction?: string;  // Transaction hash/signature
  network: string;
  payer: string;
  errorReason?: string;
}
```

- **`success`**: `boolean` - Whether the settlement succeeded
- **`transaction`** (optional): `string` - Transaction hash (EVM) or signature (SVM)
- **`network`**: `string` - The network where the transaction was submitted
- **`payer`**: `string` - The address of the payment sender
- **`errorReason`** (optional): `string` - Error reason if settlement failed

### Behavior

The settlement process:

1. **Re-verifies payment**: Verifies the payment payload again before settlement
2. **Submits transaction**: Submits the payment transaction to the blockchain
3. **Waits for confirmation**: Waits for blockchain confirmation
4. **Returns result**: Returns transaction details or error

### Example

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Create signer (requires private key)
const signer = await createSigner("base-sepolia", privateKey);

// Settle payment
const result = await settle(signer, paymentPayload, paymentRequirements);

if (result.success) {
  console.log(`Payment settled: ${result.transaction}`);
  console.log(`Network: ${result.network}`);
  console.log(`Payer: ${result.payer}`);
} else {
  console.error(`Settlement failed: ${result.errorReason}`);
}
```

### Error Handling

Common `errorReason` values:

- `"invalid_scheme"` - Unsupported payment scheme
- `"invalid_network"` - Unsupported network
- `"invalid_payment"` - Payment verification failed
- `"settle_exact_svm_block_height_exceeded"` - SVM transaction block height exceeded
- `"settle_exact_svm_transaction_confirmation_timed_out"` - SVM confirmation timeout
- `"unexpected_settle_error"` - Unexpected error during settlement

See [Error Handling Guide](../guides/error-handling.md) for detailed error handling patterns.

### Network-Specific Notes

#### EVM Networks

- Submits transaction using signer wallet
- Returns transaction hash (`0x...`)
- Waits for transaction confirmation

#### SVM Networks

- Signs and submits transaction
- Returns transaction signature (base58)
- Waits for transaction confirmation

### Implementation

The function routes to scheme-specific settlers based on `paymentRequirements.scheme` and `network`:

```82:119:src/facilitator/facilitator.ts
export async function settle<transport extends Transport, chain extends Chain>(
  client: Signer,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<SettleResponse> {
  // exact scheme
  if (paymentRequirements.scheme === "exact") {
    // evm
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      return await settleExactEvm(
        client as EvmSignerWallet<chain, transport>,
        payload,
        paymentRequirements,
      );
    }

    // svm
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      return await settleExactSvm(
        client as TransactionSigner,
        payload,
        paymentRequirements,
        config,
      );
    }
  }

  return {
    success: false,
    errorReason: "invalid_scheme",
    transaction: "",
    network: paymentRequirements.network,
    payer: SupportedEVMNetworks.includes(paymentRequirements.network)
      ? (payload.payload as ExactEvmPayload).authorization.from
      : "",
  };
}
```

## Best Practices

1. **Always verify before settling**: Call `verify()` first to ensure the payment is valid
2. **Re-verification**: The `settle()` function re-verifies the payment, but it's good practice to verify separately
3. **Error handling**: Always check `isValid` and `success` flags and handle errors appropriately
4. **Transaction confirmation**: The `settle()` function waits for confirmation, but you may want to add additional monitoring
5. **Private key security**: Never expose private keys in logs or error messages

## See Also

- [Client Creation](./client-creation.md) - Creating blockchain clients
- [Types Documentation](./types.md) - Payment payload and requirements types
- [Configuration](./config.md) - Configuration options
- [Verification Guide](../guides/verification.md) - Detailed verification guide
- [Settlement Guide](../guides/settlement.md) - Detailed settlement guide

