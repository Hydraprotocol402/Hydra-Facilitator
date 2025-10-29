# x402 Hydra Facilitator

A TypeScript library implementing the [x402 Payment Protocol](https://github.com/Hydraprotocol402/Hydra-Facilitator) facilitator pattern. This library provides payment verification and settlement functionality for both EVM and SVM (Solana Virtual Machine) networks.

## Overview

The facilitator is an optional but recommended service that simplifies payment verification and settlement between clients (buyers) and servers (sellers) in the x402 protocol. Unlike traditional payment processors, the facilitator **does not hold funds or act as a custodian**. It performs verification and execution of onchain transactions based on signed payloads provided by clients.

### Core Responsibilities

1. **Verify payments**: Confirm that client payment payloads meet server payment requirements
2. **Settle payments**: Submit validated payments to the blockchain and monitor for confirmation
3. **Provide responses**: Return verification and settlement results to servers

## Features

- ✅ **Multi-chain support**: Works with EVM and SVM networks
- ✅ **Payment verification**: Validates payment payloads against requirements without requiring blockchain transactions
- ✅ **Payment settlement**: Submits verified payments to the blockchain and waits for confirmation
- ✅ **Type-safe**: Full TypeScript support with comprehensive type definitions
- ✅ **Scheme-agnostic**: Extensible architecture supporting multiple payment schemes (currently "exact")
- ✅ **Zero-custody**: Never holds funds, only facilitates onchain transactions

## Installation

```bash
pnpm add x402-hydra-facilitator
# or
npm install x402-hydra-facilitator
# or
yarn add x402-hydra-facilitator
```

## Supported Networks

### EVM Networks
- **Base**: `base`, `base-sepolia`
- **Polygon**: `polygon`, `polygon-amoy`
- **Avalanche**: `avalanche`, `avalanche-fuji`
- **Abstract**: `abstract`, `abstract-testnet`
- **Sei**: `sei`, `sei-testnet`
- **IoTeX**: `iotex`
- **Peaq**: `peaq`

### SVM Networks
- **Solana**: `solana`, `solana-devnet`

## Quick Start

### Basic Usage

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Verification (read-only, no private key needed)
const client = createConnectedClient("base-sepolia");
const verifyResult = await verify(
  client,
  paymentPayload,
  paymentRequirements
);

if (verifyResult.isValid) {
  console.log(`Payment valid from ${verifyResult.payer}`);

  // Settlement (requires private key)
  const signer = createSigner("base-sepolia", privateKey);
  const settleResult = await settle(
    signer,
    paymentPayload,
    paymentRequirements
  );

  if (settleResult.success) {
    console.log(`Payment settled: ${settleResult.transaction}`);
  }
}
```

### API Reference

#### `verify(client, payload, requirements, config?)`

Verifies a payment payload against payment requirements without submitting to the blockchain.

**Parameters:**
- `client`: `ConnectedClient | Signer` - Blockchain client (read-only for EVM, signer for SVM)
- `payload`: `PaymentPayload` - Signed payment payload from client
- `requirements`: `PaymentRequirements` - Server's payment requirements
- `config?`: `X402Config` - Optional configuration (e.g., custom RPC URLs)

**Returns:** `Promise<VerifyResponse>`

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer: string;
}
```

#### `settle(signer, payload, requirements, config?)`

Settles a verified payment on the blockchain.

**Parameters:**
- `signer`: `Signer` - Wallet signer with private key
- `payload`: `PaymentPayload` - Signed payment payload from client
- `requirements`: `PaymentRequirements` - Server's payment requirements
- `config?`: `X402Config` - Optional configuration

**Returns:** `Promise<SettleResponse>`

```typescript
interface SettleResponse {
  success: boolean;
  transaction?: string;  // Transaction hash/signature
  network: string;
  payer: string;
  errorReason?: string;
}
```

### Client Creation

#### EVM Networks

```typescript
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";

// For verification (read-only)
const client = createConnectedClient("base-sepolia");

// For settlement (requires private key as hex string)
const signer = createSigner("base-sepolia", "0x...");
```

#### SVM Networks

```typescript
import { createSigner } from "x402-hydra-facilitator/shared";

// Both verification and settlement require a signer
// Private key must be base58 encoded string
const signer = createSigner("solana-devnet", "base58...");

// Optional: Custom RPC URL
const config = {
  svmConfig: {
    rpcUrl: "https://custom-rpc.example.com"
  }
};
```

## Integration Examples

### NestJS Implementation

A complete NestJS server implementation is provided in [`examples/nestjs/`](./examples/nestjs/). This example includes:

- REST API endpoints for `/verify`, `/settle`, and `/supported`
- Environment-based configuration
- Error handling and validation
- Support for both EVM and SVM networks

See the [NestJS example README](./examples/nestjs/README.md) for detailed setup instructions.

### Basic Express Server

```typescript
import express from "express";
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import { PaymentPayloadSchema, PaymentRequirementsSchema } from "x402-hydra-facilitator/types";

const app = express();
app.use(express.json());

// POST /verify
app.post("/verify", async (req, res) => {
  const payload = PaymentPayloadSchema.parse(req.body.paymentPayload);
  const requirements = PaymentRequirementsSchema.parse(req.body.paymentRequirements);

  const client = createConnectedClient(requirements.network);
  const result = await verify(client, payload, requirements);

  res.json(result);
});

// POST /settle
app.post("/settle", async (req, res) => {
  const payload = PaymentPayloadSchema.parse(req.body.paymentPayload);
  const requirements = PaymentRequirementsSchema.parse(req.body.paymentRequirements);

  const privateKey = process.env.PRIVATE_KEY!;
  const signer = createSigner(requirements.network, privateKey);
  const result = await settle(signer, payload, requirements);

  res.json(result);
});

app.listen(3000);
```

## Configuration

### X402Config

Optional configuration for customizing behavior:

```typescript
interface X402Config {
  svmConfig?: {
    rpcUrl?: string;  // Custom Solana RPC URL
  };
}
```

### Environment Variables

When running a facilitator service:

- `EVM_PRIVATE_KEY` - Private key for EVM networks (hex string)
- `SVM_PRIVATE_KEY` - Private key for Solana networks (base58 encoded)
- `SVM_RPC_URL` - Custom Solana RPC URL (optional)

## Payment Schemes

Currently supports the **"exact"** payment scheme:

- **EVM**: Implements `transferWithAuthorization` for USDC transfers
- **SVM**: Implements SPL token transfers

The architecture supports adding additional schemes. See [`src/schemes/`](./src/schemes/) for implementation details.

## Project Structure

```
src/
├── facilitator/        # Core facilitator functions
│   ├── facilitator.ts  # Main verify() and settle() functions
│   └── index.ts
├── schemes/            # Payment scheme implementations
│   └── exact/
│       ├── evm/        # EVM-specific implementation
│       └── svm/        # SVM-specific implementation
├── shared/             # Shared utilities
│   ├── evm/            # EVM helpers (ERC20, USDC)
│   └── svm/            # SVM helpers (RPC, transactions, wallet)
└── types/              # TypeScript type definitions
    ├── config.ts       # Configuration types
    ├── verify/         # Verification and settlement types
    └── shared/         # Shared types (network, wallet, etc.)
```

## Development

### Prerequisites

- Node.js v24 or higher
- pnpm (recommended)

### Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Format code
pnpm format
```

### Exports

The package exports multiple entry points:

- `x402-hydra-facilitator` - Main facilitator functions
- `x402-hydra-facilitator/facilitator` - Facilitator module
- `x402-hydra-facilitator/shared` - Shared utilities and client creation
- `x402-hydra-facilitator/shared/evm` - EVM-specific utilities
- `x402-hydra-facilitator/schemes` - Payment scheme implementations
- `x402-hydra-facilitator/types` - TypeScript type definitions

## Best Practices

1. **Always re-verify before settlement**: Settlement functions verify the payment payload again to ensure validity hasn't changed
2. **Network-specific client creation**: Use `createConnectedClient()` for EVM verification (read-only) and `createSigner()` for settlement
3. **Error handling**: Check `isValid` and `success` flags and handle `invalidReason` and `errorReason` appropriately
4. **Private key security**: Never expose private keys in logs or error messages
5. **Transaction confirmation**: The `settle()` function waits for blockchain confirmation before returning
6. **Schema validation**: Always validate inputs using provided Zod schemas before processing

## License

[License information to be added]

## Contributing

[Contributing guidelines to be added]

## Related Projects

- [x402 Specifications](https://github.com/Hydraprotocol402/Hydra-Facilitator) - The x402 protocol specification

