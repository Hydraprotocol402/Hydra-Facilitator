# X402 Facilitator Server - NestJS Implementation

A production-ready NestJS backend server implementation of the x402 facilitator protocol, providing endpoints for verifying and settling payments.

## Overview

This server implements the x402 facilitator interface with three main endpoints:

- `POST /verify` - Verifies payment payloads against payment requirements
- `POST /settle` - Settles verified payments on the blockchain
- `GET /supported` - Returns supported payment schemes and networks
- `GET /health` - Health check endpoint for monitoring

## Features

- **Security**: Helmet for security headers, configurable CORS, rate limiting
- **Observability**: Structured logging with Pino, request correlation IDs
- **Reliability**: Health checks, request timeouts, error handling
- **Production-Ready**: Environment-based configuration, proper error responses

## Prerequisites

- Node.js v24 or higher
- pnpm (recommended) or npm

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment variables**:

   Create a `.env` file (or copy from `.env.example` if provided) and set at least one of:
   - `EVM_PRIVATE_KEY` - Private key for EVM network operations (hex string)
   - `SVM_PRIVATE_KEY` - Private key for Solana network operations (base58 encoded string)

   Optional configuration:
   - `EVM_RPC_URL` - Custom EVM RPC URL
   - `SVM_RPC_URL` - Custom Solana RPC URL
   - `PORT` - Server port (default: 3000)
   - `NODE_ENV` - Environment (development/production)
   - `CORS_ORIGINS` - Comma-separated list of allowed CORS origins (default: allow all)
   - `ENABLE_CORS` - Enable/disable CORS (default: true)
   - `ALLOWED_NETWORKS` - Comma-separated list of allowed networks (default: all supported networks)
   - `RATE_LIMIT_TTL` - Rate limit window in seconds (default: 60)
   - `RATE_LIMIT_VERIFY` - Max requests per window for /verify (default: 100)
   - `RATE_LIMIT_SETTLE` - Max requests per window for /settle (default: 50)
   - `RATE_LIMIT_SUPPORTED` - Max requests per window for /supported (default: 200)

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

**Rate Limit**: 100 requests per minute per IP

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

**Rate Limit**: 50 requests per minute per IP

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

**Rate Limit**: 200 requests per minute per IP

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

### GET /health

Health check endpoint for monitoring and load balancers.

**Response**:
```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    }
  }
}
```

Additional endpoints:
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## Security Features

### CORS Configuration

By default, CORS is enabled for all origins. For production:

```env
CORS_ORIGINS=https://example.com,https://api.example.com
ENABLE_CORS=true
```

### Rate Limiting

Rate limiting is implemented per endpoint to prevent abuse:
- `/verify`: 100 requests/minute
- `/settle`: 50 requests/minute
- `/supported`: 200 requests/minute

Configure via environment variables if default limits need adjustment.

### Security Headers

The server uses Helmet to set security headers:
- Content Security Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security (HSTS)

### Request Timeouts

The NestJS platform sets a default request timeout. For custom timeout behavior, configure it at the NestJS application level or via a reverse proxy.

## Observability

### Structured Logging

The server uses Pino for high-performance structured logging. Logs include:
- Request correlation IDs (`X-Request-Id` header)
- Request duration
- Error stack traces (development only)

### Request Correlation

All requests receive a unique `X-Request-Id` header that is also returned in responses. This enables request tracing across services.

## Project Structure

```
src/
├── main.ts                           # Application entry point
├── app.module.ts                     # Root module with global config
├── config/
│   ├── config.module.ts              # Configuration module
│   └── config.service.ts             # Environment config service
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts  # Global error handling
│   ├── guards/
│   │   └── throttler-behind-proxy.guard.ts  # Rate limiting guard
│   └── interceptors/
│       ├── request-id.interceptor.ts  # Request ID injection
│       └── logging.interceptor.ts    # Request logging
└── facilitator/
    ├── facilitator.controller.ts     # HTTP endpoints
    ├── facilitator.service.ts        # Business logic
    ├── facilitator.module.ts         # Facilitator module
    ├── health.controller.ts          # Health check endpoints
    └── dto/
        ├── verify.dto.ts             # Verify request DTO
        └── settle.dto.ts            # Settle request DTO
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

## Production Deployment

### Environment Variables

Ensure all required environment variables are set:
- At least one private key (`EVM_PRIVATE_KEY` or `SVM_PRIVATE_KEY`)
- `NODE_ENV=production`
- `CORS_ORIGINS` with your allowed origins
- Consider setting `RATE_LIMIT_*` based on expected load
- Optionally set `ALLOWED_NETWORKS` to restrict which networks are supported
- Optionally set `EVM_RPC_URL` or `SVM_RPC_URL` for custom RPC endpoints

### Behind a Reverse Proxy

When deployed behind a reverse proxy (nginx, Cloudflare, etc.):
- The rate limiter automatically uses `X-Forwarded-For` header
- Ensure your proxy forwards the client IP correctly
- Configure proxy to respect request timeouts

### Health Checks

Use the health endpoints for:
- Kubernetes liveness/readiness probes: `/health/live`, `/health/ready`
- Load balancer health checks: `/health`

### Monitoring

Monitor these metrics:
- Request rate and latency
- Error rates by endpoint
- Rate limiting hits
- Blockchain transaction success rate
- Memory usage (via `/health`)

## Notes

- The server validates that at least one private key (EVM or SVM) is configured on startup
- Payment payloads and requirements are validated using Zod schemas from the x402-hydra-facilitator package
- The `/supported` endpoint dynamically returns supported networks based on available private keys
- SVM verification requires a signer (not just a connected client) because it signs and simulates transactions
- Error responses preserve x402 protocol structure for `/verify` and `/settle` endpoints
- Private keys are never logged or exposed in error messages
