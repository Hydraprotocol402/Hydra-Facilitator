# Network Support Guide

This guide explains how to add support for new networks in the facilitator package.

## Overview

The facilitator supports both EVM and SVM networks. Adding a new network involves updating network constants and potentially adding network-specific configuration.

## Network Types

### EVM Networks

EVM networks use:
- viem for blockchain interactions
- EIP-712 signatures
- USDC token contracts

### SVM Networks

SVM networks use:
- @solana/kit for transaction handling
- Base58 encoded transactions
- SPL token transfers

## Adding an EVM Network

### Step 1: Add Network Constant

Update `src/types/shared/network.ts`:

```typescript
export const NetworkSchema = z.enum([
  // ... existing networks
  "your-network",
]);

export const SupportedEVMNetworks: Network[] = [
  // ... existing networks
  "your-network",
];

export const EvmNetworkToChainId = new Map<Network, number>([
  // ... existing mappings
  ["your-network", 12345], // Your network's chain ID
]);
```

### Step 2: Add Chain Definition

If using viem, add chain definition to `src/types/shared/evm/wallet.ts`:

```typescript
import { yourNetwork } from "viem/chains";

export function getChainFromNetwork(network: string | undefined): Chain {
  switch (network) {
    // ... existing cases
    case "your-network":
      return yourNetwork;
    // ...
  }
}
```

If viem doesn't have your chain, create a custom chain definition:

```typescript
import { defineChain } from "viem";

export const yourNetwork = defineChain({
  id: 12345,
  name: "Your Network",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.yournetwork.com"],
    },
  },
});
```

### Step 3: Update USDC Configuration

If your network uses USDC, add USDC configuration to `src/types/shared/evm/usdc.ts`:

```typescript
export const config: Record<string, { usdcName: string; usdcAddress: Address }> = {
  // ... existing configs
  "12345": {
    usdcName: "USD Coin",
    usdcAddress: "0x...", // USDC contract address on your network
  },
};
```

### Step 4: Test Network Support

Test that your network works:

```typescript
import { createConnectedClient } from "x402-hydra-facilitator/shared";

const client = createConnectedClient("your-network");
// Should create client without errors
```

## Adding an SVM Network

### Step 1: Add Network Constant

Update `src/types/shared/network.ts`:

```typescript
export const NetworkSchema = z.enum([
  // ... existing networks
  "your-svm-network",
]);

export const SupportedSVMNetworks: Network[] = [
  // ... existing networks
  "your-svm-network",
];

export const SvmNetworkToChainId = new Map<Network, number>([
  // ... existing mappings
  ["your-svm-network", 123], // Your network's chain ID
]);
```

### Step 2: Update RPC Client

Update `src/shared/svm/rpc.ts` to handle your network:

```typescript
export function getRpcClient(
  network: Network,
  customRpcUrl?: string,
): SolanaRpcApiMainnet | SolanaRpcApiDevnet {
  if (customRpcUrl) {
    return createSolanaRpc(customRpcUrl);
  }

  switch (network) {
    // ... existing cases
    case "your-svm-network":
      return createSolanaRpc("https://api.yournetwork.com");
    // ...
  }
}
```

### Step 3: Test Network Support

Test that your network works:

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

const signer = await createSigner("your-svm-network", privateKey);
// Should create signer without errors
```

## Network-Specific Considerations

### Custom RPC URLs

Networks may require custom RPC configuration:

```typescript
const config: X402Config = {
  evmConfig: {
    rpcUrl: "https://custom-rpc.yournetwork.com",
  },
};
```

### Token Contracts

Different networks use different token contracts:

- **USDC**: May have different addresses on different networks
- **SPL Tokens**: May use different mint addresses

### Gas/Compute Units

Different networks have different:

- Gas price structures
- Compute unit limits
- Transaction confirmation times

## Testing New Networks

### Unit Tests

Add tests for network support:

```typescript
describe("Network Support", () => {
  it("should support your-network", () => {
    const client = createConnectedClient("your-network");
    expect(client).toBeDefined();
  });
});
```

### Integration Tests

Test full payment flow:

```typescript
describe("Payment Flow on Your Network", () => {
  it("should verify and settle payments", async () => {
    // Test verification
    const verifyResult = await verify(client, payload, requirements);
    expect(verifyResult.isValid).toBe(true);

    // Test settlement
    const settleResult = await settle(signer, payload, requirements);
    expect(settleResult.success).toBe(true);
  });
});
```

## Best Practices

### 1. Network Validation

Always validate network names:

```typescript
if (!SupportedEVMNetworks.includes(network)) {
  throw new Error(`Unsupported network: ${network}`);
}
```

### 2. Chain ID Mapping

Keep chain ID mappings up to date:

```typescript
export const EvmNetworkToChainId = new Map<Network, number>([
  ["your-network", 12345],
]);
```

### 3. RPC Configuration

Support custom RPC URLs:

```typescript
const rpcUrl = config?.evmConfig?.rpcUrl;
const client = createConnectedClient(network, rpcUrl ? { evmConfig: { rpcUrl } } : undefined);
```

### 4. Error Messages

Provide clear error messages for unsupported networks:

```typescript
throw new Error(`Network ${network} is not supported. Supported networks: ${SupportedEVMNetworks.join(", ")}`);
```

## See Also

- [Scheme Extension Guide](./schemes.md) - Adding payment schemes
- [API Reference](../api-reference/) - Network API documentation
- [EVM Networks Guide](../guides/evm-networks.md) - EVM-specific guidance
- [SVM Networks Guide](../guides/svm-networks.md) - SVM-specific guidance

