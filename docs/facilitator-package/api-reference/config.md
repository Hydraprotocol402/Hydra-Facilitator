# Configuration

The facilitator package supports optional configuration for customizing RPC connections and network behavior.

## X402Config

The main configuration interface for X402 operations.

```typescript
interface X402Config {
  evmConfig?: EvmConfig;
  svmConfig?: SvmConfig;
}
```

### EvmConfig

Configuration for EVM network connections.

```typescript
interface EvmConfig {
  rpcUrl?: string;
}
```

**Fields:**
- **`rpcUrl`** (optional): `string` - Custom RPC URL for EVM connections. If not provided, defaults to the RPC URL from the chain definition.

### SvmConfig

Configuration for SVM (Solana) network connections.

```typescript
interface SvmConfig {
  rpcUrl?: string;
}
```

**Fields:**
- **`rpcUrl`** (optional): `string` - Custom RPC URL for Solana connections. If not provided, defaults to public Solana RPC endpoints based on network.

## Usage

### With verify()

```typescript
import { verify } from "x402-hydra-facilitator";
import { createConnectedClient } from "x402-hydra-facilitator/shared";
import type { X402Config } from "x402-hydra-facilitator/types";

// Custom EVM RPC
const config: X402Config = {
  evmConfig: {
    rpcUrl: "https://custom-evm-rpc.example.com",
  },
};

const client = createConnectedClient("base-sepolia", config);
const result = await verify(client, payload, requirements, config);
```

### With settle()

```typescript
import { settle } from "x402-hydra-facilitator";
import { createSigner } from "x402-hydra-facilitator/shared";
import type { X402Config } from "x402-hydra-facilitator/types";

// Custom SVM RPC
const config: X402Config = {
  svmConfig: {
    rpcUrl: "https://custom-solana-rpc.example.com",
  },
};

const signer = await createSigner("solana-devnet", privateKey, config);
const result = await settle(signer, payload, requirements, config);
```

### With Client Creation

Configuration can be passed when creating clients:

```typescript
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { X402Config } from "x402-hydra-facilitator/types";

// EVM client with custom RPC
const evmConfig: X402Config = {
  evmConfig: {
    rpcUrl: "https://custom-evm-rpc.example.com",
  },
};
const evmClient = createConnectedClient("base-sepolia", evmConfig);

// SVM signer with custom RPC
const svmConfig: X402Config = {
  svmConfig: {
    rpcUrl: "https://custom-solana-rpc.example.com",
  },
};
const svmSigner = await createSigner("solana-devnet", privateKey, svmConfig);
```

## Implementation

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

## When to Use Custom RPC URLs

### Production Environments

Use custom RPC URLs for:
- **Higher rate limits**: Public RPC endpoints have rate limits
- **Better reliability**: Dedicated RPC endpoints provide better uptime
- **Lower latency**: Closer RPC endpoints reduce latency
- **Private networks**: Connect to private or test networks

### Development Environments

Use default RPC URLs for:
- **Quick prototyping**: No setup required
- **Testing**: Default endpoints work for testing
- **Local development**: Use public endpoints for development

## Best Practices

1. **Environment variables**: Store RPC URLs in environment variables
2. **Network-specific configs**: Use different configs for different networks
3. **Fallback handling**: Handle cases where custom RPC is unavailable
4. **Error handling**: Provide clear errors when RPC connection fails

## Example: Environment-Based Configuration

```typescript
import type { X402Config } from "x402-hydra-facilitator/types";

function getConfig(): X402Config {
  const config: X402Config = {};

  // EVM RPC from environment
  if (process.env.EVM_RPC_URL) {
    config.evmConfig = {
      rpcUrl: process.env.EVM_RPC_URL,
    };
  }

  // SVM RPC from environment
  if (process.env.SVM_RPC_URL) {
    config.svmConfig = {
      rpcUrl: process.env.SVM_RPC_URL,
    };
  }

  return config;
}

// Usage
const config = getConfig();
const client = createConnectedClient("base-sepolia", config);
```

## See Also

- [Core Functions](./core-functions.md) - Using config with verify() and settle()
- [Client Creation](./client-creation.md) - Configuring clients
- [EVM Networks Guide](../guides/evm-networks.md) - EVM-specific configuration
- [SVM Networks Guide](../guides/svm-networks.md) - SVM-specific configuration

