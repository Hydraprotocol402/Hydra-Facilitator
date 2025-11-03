# Architecture Overview

This document provides an overview of the facilitator package architecture.

## Package Structure

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

## Core Components

### Facilitator Module

The main facilitator module (`src/facilitator/facilitator.ts`) provides:

- `verify()` - Payment verification function
- `settle()` - Payment settlement function

These functions route to scheme-specific implementations based on the payment requirements.

### Scheme Implementations

Payment schemes are implemented in `src/schemes/`:

- **exact** scheme: Currently supported scheme
  - **EVM**: `src/schemes/exact/evm/` - USDC transfers using `transferWithAuthorization`
  - **SVM**: `src/schemes/exact/svm/` - SPL token transfers

### Shared Utilities

Shared utilities in `src/shared/`:

- **EVM**: ERC20/USDC helpers, client creation
- **SVM**: RPC client, transaction handling, wallet creation

### Type Definitions

Type definitions in `src/types/`:

- **config.ts**: Configuration types
- **verify/**: Payment payload, requirements, responses
- **shared/**: Network, wallet, and other shared types

## Architecture Principles

### 1. Scheme-Agnostic Design

The facilitator is designed to support multiple payment schemes. The main functions route to scheme-specific implementations:

```typescript
if (paymentRequirements.scheme === "exact") {
  // Route to exact scheme implementation
}
```

### 2. Network Abstraction

The package abstracts network differences through:

- Network-specific client creation
- Network-specific type guards
- Network-specific error handling

### 3. Type Safety

Full TypeScript support with:

- Zod schemas for runtime validation
- Type inference from schemas
- Comprehensive type definitions

### 4. Extensibility

The architecture supports:

- Adding new payment schemes
- Adding new network support
- Custom configuration options

## Data Flow

### Verification Flow

```
Client → PaymentPayload → verify() → Scheme Router → Scheme Verifier → VerifyResponse
```

1. Client provides payment payload
2. `verify()` routes to appropriate scheme
3. Scheme verifier validates payment
4. Returns verification result

### Settlement Flow

```
Client → PaymentPayload → settle() → Scheme Router → Scheme Settler → Blockchain → SettleResponse
```

1. Client provides payment payload
2. `settle()` routes to appropriate scheme
3. Scheme settler re-verifies and submits transaction
4. Waits for blockchain confirmation
5. Returns settlement result

## Extension Points

### Adding a New Scheme

1. Create scheme directory in `src/schemes/`
2. Implement `verify()` and `settle()` functions
3. Add scheme-specific types
4. Update main router to include new scheme

### Adding a New Network

1. Add network to `SupportedEVMNetworks` or `SupportedSVMNetworks`
2. Add network mapping in `EvmNetworkToChainId` or `SvmNetworkToChainId`
3. Update client creation functions if needed
4. Update scheme implementations if needed

## Dependencies

### Core Dependencies

- **viem**: EVM blockchain interactions
- **@solana/kit**: Solana transaction handling
- **zod**: Runtime validation and type inference

### Type Definitions

- Full TypeScript support
- Type inference from Zod schemas
- Comprehensive type exports

## See Also

- [Scheme Extension Guide](./schemes.md) - Adding new payment schemes
- [Network Support Guide](./network-support.md) - Adding new networks
- [API Reference](../api-reference/) - Complete API documentation

