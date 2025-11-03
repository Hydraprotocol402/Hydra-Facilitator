# Client Creation

The facilitator package provides functions to create blockchain clients for verification and settlement. The client type depends on the network (EVM or SVM) and the operation (verification or settlement).

## Overview

- **EVM Networks**: Use `createConnectedClient()` for verification (read-only) and `createSigner()` for settlement
- **SVM Networks**: Use `createSigner()` for both verification and settlement (signer required)

## createConnectedClient()

Creates a read-only client for EVM networks. This is used for verification operations that don't require transaction signing.

### Signature

```typescript
function createConnectedClient(
  network: string,
  config?: X402Config,
): ConnectedClient
```

### Parameters

- **`network`**: `string` - The network name (e.g., `"base-sepolia"`, `"polygon"`)
- **`config`** (optional): `X402Config` - Optional configuration for custom RPC URLs

### Returns

- **`ConnectedClient`**: A read-only blockchain client for EVM networks

### Example

```typescript
import { createConnectedClient } from "x402-hydra-facilitator/shared";

// Create client for Base Sepolia
const client = createConnectedClient("base-sepolia");

// With custom RPC URL
const config = {
  evmConfig: {
    rpcUrl: "https://custom-rpc.example.com",
  },
};
const clientWithCustomRpc = createConnectedClient("base-sepolia", config);
```

### Supported Networks

EVM networks only:
- `"base"`, `"base-sepolia"`
- `"polygon"`, `"polygon-amoy"`
- `"avalanche"`, `"avalanche-fuji"`
- `"abstract"`, `"abstract-testnet"`
- `"sei"`, `"sei-testnet"`
- `"iotex"`
- `"peaq"`

### Implementation

```18:29:src/types/shared/wallet.ts
export function createConnectedClient(network: string, config?: X402Config): ConnectedClient {
  if (SupportedEVMNetworks.find(n => n === network)) {
    const rpcUrl = config?.evmConfig?.rpcUrl;
    return evm.createConnectedClient(network, rpcUrl);
  }

  if (SupportedSVMNetworks.find(n => n === network)) {
    return svm.createSvmConnectedClient(network);
  }

  throw new Error(`Unsupported network: ${network}`);
}
```

## createSigner()

Creates a wallet signer for submitting transactions. Required for settlement operations on all networks and for verification on SVM networks.

### Signature

```typescript
function createSigner(
  network: string,
  privateKey: Hex | string,
  config?: X402Config,
): Promise<Signer>
```

### Parameters

- **`network`**: `string` - The network name
- **`privateKey`**: `Hex | string`
  - For EVM: Hex string (e.g., `"0x..."`)
  - For SVM: Base58 encoded string
- **`config`** (optional): `X402Config` - Optional configuration for custom RPC URLs

### Returns

- **`Promise<Signer>`**: A wallet signer for the specified network

### Example

#### EVM Networks

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

// EVM private key (hex string)
const evmPrivateKey = "0x1234567890abcdef...";
const signer = await createSigner("base-sepolia", evmPrivateKey);

// With custom RPC URL
const config = {
  evmConfig: {
    rpcUrl: "https://custom-rpc.example.com",
  },
};
const signerWithCustomRpc = await createSigner("base-sepolia", evmPrivateKey, config);
```

#### SVM Networks

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

// SVM private key (base58 encoded string)
const svmPrivateKey = "base58encodedprivatekey...";
const signer = await createSigner("solana-devnet", svmPrivateKey);

// With custom RPC URL
const config = {
  svmConfig: {
    rpcUrl: "https://custom-solana-rpc.example.com",
  },
};
const signerWithCustomRpc = await createSigner("solana-devnet", svmPrivateKey, config);
```

### Supported Networks

All supported networks:
- **EVM**: `"base"`, `"base-sepolia"`, `"polygon"`, `"polygon-amoy"`, `"avalanche"`, `"avalanche-fuji"`, `"abstract"`, `"abstract-testnet"`, `"sei"`, `"sei-testnet"`, `"iotex"`, `"peaq"`
- **SVM**: `"solana"`, `"solana-devnet"`

### Implementation

```39:54:src/types/shared/wallet.ts
export function createSigner(
  network: string,
  privateKey: Hex | string,
  config?: X402Config,
): Promise<Signer> {
  if (SupportedEVMNetworks.find(n => n === network)) {
    const rpcUrl = config?.evmConfig?.rpcUrl;
    return Promise.resolve(evm.createSigner(network, privateKey as Hex, rpcUrl));
  }

  if (SupportedSVMNetworks.find(n => n === network)) {
    return svm.createSignerFromBase58(privateKey as string);
  }

  throw new Error(`Unsupported network: ${network}`);
}
```

## Private Key Formats

### EVM Networks

Private keys must be hex strings starting with `0x`:

```typescript
// Valid formats
const evmKey1 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const evmKey2 = "0x" + "1".repeat(64); // 64 hex characters
```

### SVM Networks

Private keys must be base58 encoded strings:

```typescript
// Valid format (base58 encoded)
const svmKey = "5KQwrK1x9v8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J8vZ5J";
```

## Type Guards

The package provides type guards to check client types:

### isEvmSignerWallet()

```typescript
import { isEvmSignerWallet } from "x402-hydra-facilitator/shared";

if (isEvmSignerWallet(signer)) {
  // signer is EvmSigner
  // EVM-specific operations
}
```

### isSvmSignerWallet()

```typescript
import { isSvmSignerWallet } from "x402-hydra-facilitator/shared";

if (isSvmSignerWallet(signer)) {
  // signer is SvmSigner
  // SVM-specific operations (e.g., get feePayer address)
  const feePayer = signer.address;
}
```

### Implementation

```62:74:src/types/shared/wallet.ts
export function isEvmSignerWallet(wallet: Signer): wallet is evm.EvmSigner {
  return evm.isSignerWallet(wallet as evm.EvmSigner) || evm.isAccount(wallet as evm.EvmSigner);
}

/**
 * Checks if the given wallet is an SVM signer wallet
 *
 * @param wallet - The object wallet to check
 * @returns True if the wallet is an SVM signer wallet, false otherwise
 */
export function isSvmSignerWallet(wallet: Signer): wallet is svm.SvmSigner {
  return svm.isSignerWallet(wallet);
}
```

## Usage Patterns

### Verification Pattern (EVM)

```typescript
import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";

// Read-only client for verification
const client = createConnectedClient("base-sepolia");
const result = await verify(client, payload, requirements);
```

### Settlement Pattern (EVM)

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";

// Signer for settlement
const signer = await createSigner("base-sepolia", privateKey);
const result = await settle(signer, payload, requirements);
```

### Verification Pattern (SVM)

```typescript
import { verify } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";

// Signer required for SVM verification
const signer = await createSigner("solana-devnet", privateKey);
const result = await verify(signer, payload, requirements);
```

### Settlement Pattern (SVM)

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";

// Signer for settlement
const signer = await createSigner("solana-devnet", privateKey);
const result = await settle(signer, payload, requirements);
```

## Custom RPC Configuration

You can configure custom RPC URLs for both EVM and SVM networks:

```typescript
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { X402Config } from "x402-hydra-facilitator/types";

// Custom EVM RPC
const evmConfig: X402Config = {
  evmConfig: {
    rpcUrl: "https://custom-evm-rpc.example.com",
  },
};
const client = createConnectedClient("base-sepolia", evmConfig);

// Custom SVM RPC
const svmConfig: X402Config = {
  svmConfig: {
    rpcUrl: "https://custom-solana-rpc.example.com",
  },
};
const signer = await createSigner("solana-devnet", privateKey, svmConfig);
```

## Error Handling

Client creation functions throw errors for unsupported networks:

```typescript
try {
  const client = createConnectedClient("unsupported-network");
} catch (error) {
  // Error: Unsupported network: unsupported-network
}
```

## Best Practices

1. **Use appropriate client type**: Use `createConnectedClient()` for EVM verification (read-only), `createSigner()` for settlement
2. **Private key security**: Never expose private keys in logs or error messages
3. **Network validation**: Validate network names before creating clients
4. **RPC configuration**: Use custom RPC URLs for production environments
5. **Type guards**: Use type guards when working with multiple network types

## See Also

- [Core Functions](./core-functions.md) - Using clients with verify() and settle()
- [Configuration](./config.md) - Configuration options
- [EVM Networks Guide](../guides/evm-networks.md) - EVM-specific guidance
- [SVM Networks Guide](../guides/svm-networks.md) - SVM-specific guidance

