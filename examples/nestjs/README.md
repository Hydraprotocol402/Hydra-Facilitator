# X402 Facilitator Server - NestJS Implementation

A NestJS backend server implementation of the x402 facilitator protocol, providing endpoints for verifying and settling payments.

## Overview

This server implements the x402 facilitator interface with three main endpoints:

- `POST /verify` - Verifies payment payloads against payment requirements
- `POST /settle` - Settles verified payments on the blockchain
- `GET /supported` - Returns supported payment schemes and networks

## Prerequisites

- Node.js v24 or higher
- pnpm (recommended) or npm

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set at least one of:
   - `EVM_PRIVATE_KEY` - Private key for EVM network operations (hex string)
   - `SVM_PRIVATE_KEY` - Private key for Solana network operations (base58 encoded string)

   Optional:
   - `SVM_RPC_URL` - Custom Solana RPC URL
   - `PORT` - Server port (default: 3000)

3. **Build the parent package** (if using workspace):
   ```bash
   cd ../..
   pnpm build
   ```

## Running

**Development mode** (with hot reload):
```bash
pnpm start:dev
```

**Production mode**:
```bash
pnpm build
pnpm start:prod
```

The server will start on `http://localhost:3000` (or your configured PORT).

## API Endpoints

### POST /verify

Verifies a payment payload against payment requirements.

**Request Body**:
```json
{
  "paymentPayload": {
    "x402Version": 1,
    "scheme": "exact",
    "network": "base-sepolia",
    "payload": { ... }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000000",
    "resource": "https://example.com/resource",
    "description": "Example resource",
    "mimeType": "application/json",
    "payTo": "0x...",
    "maxTimeoutSeconds": 300,
    "asset": "0x...",
    "extra": { ... }
  }
}
```

**Response**:
```json
{
  "isValid": true,
  "invalidReason": null,
  "payer": "0x..."
}
```

### POST /settle

Settles a verified payment on the blockchain.

**Request Body**: Same as `/verify`

**Response**:
```json
{
  "success": true,
  "errorReason": null,
  "transaction": "0x...",
  "network": "base-sepolia",
  "payer": "0x..."
}
```

### GET /supported

Returns supported payment schemes and networks based on configured private keys.

**Response**:
```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia"
    },
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "solana-devnet",
      "extra": {
        "feePayer": "..."
      }
    }
  ]
}
```

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── config/
│   ├── config.module.ts       # Configuration module
│   └── config.service.ts      # Environment config service
└── facilitator/
    ├── facilitator.controller.ts  # HTTP endpoints
    ├── facilitator.service.ts     # Business logic
    ├── facilitator.module.ts      # Facilitator module
    └── dto/
        ├── verify.dto.ts      # Verify request DTO
        └── settle.dto.ts      # Settle request DTO
```

## Development

**Run linting**:
```bash
pnpm lint
```

**Run tests**:
```bash
pnpm test
```

## Notes

- The server validates that at least one private key (EVM or SVM) is configured on startup
- Payment payloads and requirements are validated using Zod schemas from the x402 package
- The `/supported` endpoint dynamically returns supported networks based on available private keys
- SVM verification requires a signer (not just a connected client) because it signs and simulates transactions

