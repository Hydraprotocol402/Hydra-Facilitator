# Installation

This guide covers installing and setting up the `x402-hydra-facilitator` package.

## Prerequisites

- Node.js v24 or higher
- Package manager: pnpm (recommended), npm, or yarn

## Installation

### Using pnpm (Recommended)

```bash
pnpm add x402-hydra-facilitator
```

### Using npm

```bash
npm install x402-hydra-facilitator
```

### Using yarn

```bash
yarn add x402-hydra-facilitator
```

## TypeScript Setup

The package includes TypeScript definitions, so no additional type packages are needed. Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "node",
    "target": "ES2020",
    "lib": ["ES2020"],
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Package Exports

The package supports both ESM and CommonJS imports:

### ESM (Recommended)

```typescript
import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements } from "x402-hydra-facilitator/types";
```

### CommonJS

```typescript
const { verify, settle } = require("x402-hydra-facilitator");
const { createConnectedClient, createSigner } = require("x402-hydra-facilitator/shared");
```

## Available Entry Points

- `x402-hydra-facilitator` - Main facilitator functions
- `x402-hydra-facilitator/facilitator` - Facilitator module
- `x402-hydra-facilitator/shared` - Shared utilities and client creation
- `x402-hydra-facilitator/shared/evm` - EVM-specific utilities
- `x402-hydra-facilitator/schemes` - Payment scheme implementations
- `x402-hydra-facilitator/types` - TypeScript type definitions

## Verification

After installation, verify the package is working:

```typescript
import { verify } from "x402-hydra-facilitator";
import { x402Version } from "x402-hydra-facilitator";

console.log(`x402 version: ${x402Version}`); // Should output: 1
```

## Next Steps

- [Getting Started Guide](./guides/getting-started.md) - Step-by-step tutorial
- [API Reference](./api-reference/core-functions.md) - Complete API documentation

