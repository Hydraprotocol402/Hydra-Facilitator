# Facilitator Package

The `x402-hydra-facilitator` package is a TypeScript library that implements the x402 Payment Protocol facilitator pattern. It provides payment verification and settlement functionality for both EVM and SVM (Solana Virtual Machine) networks.

## Overview

The facilitator package simplifies payment verification and settlement by:

- **Verifying payments** without requiring blockchain transactions (read-only verification)
- **Settling payments** by submitting verified transactions to the blockchain
- **Supporting multiple networks** across EVM and SVM ecosystems
- **Providing type-safe APIs** with full TypeScript support

The facilitator does **not** hold funds or act as a custodian. It performs verification and execution of onchain transactions based on signed payloads provided by clients.

## Installation

```bash
pnpm add x402-hydra-facilitator
# or
npm install x402-hydra-facilitator
# or
yarn add x402-hydra-facilitator
```

See [Installation Guide](./installation.md) for detailed setup instructions.

## Quick Start

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";

// Verification (read-only, no private key needed)
const client = createConnectedClient("base-sepolia");
const verifyResult = await verify(client, paymentPayload, paymentRequirements);

if (verifyResult.isValid) {
  console.log(`Payment valid from ${verifyResult.payer}`);

  // Settlement (requires private key)
  const signer = createSigner("base-sepolia", privateKey);
  const settleResult = await settle(signer, paymentPayload, paymentRequirements);

  if (settleResult.success) {
    console.log(`Payment settled: ${settleResult.transaction}`);
  }
}
```

See [Getting Started Guide](./guides/getting-started.md) for a complete tutorial.

## Features

- ✅ **Multi-chain support**: Works with EVM and SVM networks
- ✅ **Payment verification**: Validates payment payloads without blockchain transactions
- ✅ **Payment settlement**: Submits verified payments to the blockchain
- ✅ **Type-safe**: Full TypeScript support with comprehensive type definitions
- ✅ **Scheme-agnostic**: Extensible architecture supporting multiple payment schemes
- ✅ **Zero-custody**: Never holds funds, only facilitates onchain transactions

## Supported Networks

### EVM Networks
- Base (`base`, `base-sepolia`)
- Polygon (`polygon`, `polygon-amoy`)
- Avalanche (`avalanche`, `avalanche-fuji`)
- Abstract (`abstract`, `abstract-testnet`)
- Sei (`sei`, `sei-testnet`)
- IoTeX (`iotex`)
- Peaq (`peaq`)

### SVM Networks
- Solana (`solana`, `solana-devnet`)

## Package Exports

The package exports multiple entry points:

- `x402-hydra-facilitator` - Main facilitator functions (`verify`, `settle`)
- `x402-hydra-facilitator/facilitator` - Facilitator module
- `x402-hydra-facilitator/shared` - Shared utilities and client creation
- `x402-hydra-facilitator/shared/evm` - EVM-specific utilities
- `x402-hydra-facilitator/schemes` - Payment scheme implementations
- `x402-hydra-facilitator/types` - TypeScript type definitions

## Documentation

### API Reference

- [Core Functions](./api-reference/core-functions.md) - `verify()` and `settle()` functions
- [Client Creation](./api-reference/client-creation.md) - Creating blockchain clients
- [Types](./api-reference/types.md) - TypeScript types and interfaces
- [Configuration](./api-reference/config.md) - Configuration options
- [Schemes](./api-reference/schemes.md) - Payment scheme implementations

### Guides

- [Getting Started](./guides/getting-started.md) - Step-by-step tutorial
- [Verification](./guides/verification.md) - Payment verification guide
- [Settlement](./guides/settlement.md) - Payment settlement guide
- [EVM Networks](./guides/evm-networks.md) - Working with EVM networks
- [SVM Networks](./guides/svm-networks.md) - Working with SVM networks
- [Error Handling](./guides/error-handling.md) - Error handling patterns

### Examples

- [Basic Usage](./examples/basic-usage.ts) - Simple verification example
- [Full Flow](./examples/full-flow.ts) - Complete verify + settle flow
- [Express Server](./examples/express-server.ts) - Express.js integration
- [Custom RPC](./examples/custom-rpc.ts) - Custom RPC configuration

### Architecture

- [Overview](./architecture/overview.md) - Package architecture
- [Schemes](./architecture/schemes.md) - Scheme extension guide
- [Network Support](./architecture/network-support.md) - Adding new networks

## Payment Schemes

Currently supports the **"exact"** payment scheme:

- **EVM**: Implements `transferWithAuthorization` for USDC transfers
- **SVM**: Implements SPL token transfers

The architecture supports adding additional schemes. See [Schemes Documentation](./api-reference/schemes.md) for details.

## Best Practices

1. **Always re-verify before settlement**: Settlement functions verify the payment payload again to ensure validity hasn't changed
2. **Network-specific client creation**: Use `createConnectedClient()` for EVM verification (read-only) and `createSigner()` for settlement
3. **Error handling**: Check `isValid` and `success` flags and handle `invalidReason` and `errorReason` appropriately
4. **Private key security**: Never expose private keys in logs or error messages
5. **Transaction confirmation**: The `settle()` function waits for blockchain confirmation before returning
6. **Schema validation**: Always validate inputs using provided Zod schemas before processing

## Related Resources

- [Main Documentation](../README.md) - Main documentation index
- [NestJS Backend](../nestjs-backend/README.md) - Backend application using this package
- [Package README](../../README.md) - Package README with quick reference

