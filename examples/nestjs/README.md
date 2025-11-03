# X402 Facilitator Server - NestJS Implementation

A production-ready NestJS backend server implementation of the x402 facilitator protocol, providing endpoints for verifying and settling payments.

## Overview

This server implements the x402 facilitator interface with the following endpoints:

- `POST /verify` - Verifies payment payloads against payment requirements
- `POST /settle` - Settles verified payments on the blockchain
- `GET /supported` - Returns supported payment schemes and networks
- `GET /discovery/resources` - Lists discoverable x402-enabled resources (Discovery Layer/Bazaar)
- `GET /list` - Alias for `/discovery/resources` (redirects)
- `GET /health` - Health check endpoint for monitoring

## Features

- **Security**: Helmet for security headers, configurable CORS, rate limiting
- **Observability**: Structured logging with Pino, request correlation IDs
- **Reliability**: Health checks, request timeouts, error handling
- **Production-Ready**: Environment-based configuration, proper error responses

## Prerequisites

- Node.js v24 or higher
- pnpm (recommended) or npm
- PostgreSQL database (for discovery layer functionality)

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up PostgreSQL database**:

   Create a PostgreSQL database for the discovery layer:
   ```bash
   # Using psql
   createdb x402_facilitator
   # Or using SQL
   psql -U postgres -c "CREATE DATABASE x402_facilitator;"
   ```

3. **Configure environment variables**:

   Create a `.env` file (or copy from `.env.example` if provided) and set at least one of:
   - `EVM_PRIVATE_KEY` - Private key for EVM network operations (hex string)
   - `SVM_PRIVATE_KEY` - Private key for Solana network operations (base58 encoded string)
   - `DATABASE_URL` - PostgreSQL connection string (required for discovery layer)
     Example: `postgresql://user:password@localhost:5432/x402_facilitator`

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
   - `RATE_LIMIT_DISCOVERY` - Max requests per window for /discovery/resources (default: 200)
   - `ALLOW_LOCALHOST_RESOURCES` - Allow localhost/private IP resources in discovery (default: false). Set to `true` for development/testing only

4. **Initialize database schema**:

   Generate Prisma client and run migrations:
   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

5. **Build the parent package** (if using workspace):
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

### GET /discovery/resources

Lists discoverable x402-enabled resources (Discovery Layer/Bazaar). Resources are automatically registered when payments are successfully settled.

**Rate Limit**: 200 requests per minute per IP

**Query Parameters**:
- `type` (optional) - Filter by resource type (e.g., "http")
- `limit` (optional) - Maximum number of results (1-1000, default: 100)
- `offset` (optional) - Number of results to skip for pagination (default: 0)
- `metadata` (optional) - JSON object for metadata filtering

**Response**:
```json
{
  "x402Version": 1,
  "items": [
    {
      "resource": "https://api.example.com/premium-data",
      "type": "http",
      "x402Version": 1,
      "accepts": [
        {
          "scheme": "exact",
          "network": "base-sepolia",
          "maxAmountRequired": "10000",
          "resource": "https://api.example.com/premium-data",
          "description": "Access to premium market data",
          "mimeType": "application/json",
          "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
          "maxTimeoutSeconds": 60,
          "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "extra": {
            "name": "USDC",
            "version": "2"
          }
        }
      ],
      "lastUpdated": "2025-01-09T01:07:04.005Z",
      "metadata": {}
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1
  }
}
```

**Notes**:
- Resources inactive for 7+ days are automatically filtered out (TTL)
- Resources are only listed if they have received successful payments (auto-registration on settlement)
- Supports pagination for large result sets

### GET /list

Alias for `/discovery/resources` that redirects to the discovery endpoint. Maintained for compatibility.

**Rate Limit**: 200 requests per minute per IP

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
- `/discovery/resources`: 200 requests/minute

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
│   ├── interceptors/
│   │   ├── request-id.interceptor.ts  # Request ID injection
│   │   └── logging.interceptor.ts    # Request logging
│   └── prisma/
│       ├── prisma.module.ts         # Prisma database module
│       └── prisma.service.ts        # Prisma client service
├── discovery/
│   ├── discovery.module.ts           # Discovery module
│   ├── discovery.service.ts          # Discovery business logic
│   ├── discovery.controller.ts       # Discovery HTTP endpoints
│   └── dto/
│       └── list-resources.dto.ts    # Discovery query DTO
└── facilitator/
    ├── facilitator.controller.ts     # HTTP endpoints
    ├── facilitator.service.ts        # Business logic
    ├── facilitator.module.ts         # Facilitator module
    ├── health.controller.ts          # Health check endpoints
    └── dto/
        ├── verify.dto.ts             # Verify request DTO
        └── settle.dto.ts            # Settle request DTO
prisma/
└── schema.prisma                     # Prisma database schema
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
- `DATABASE_URL` - PostgreSQL connection string (required for discovery layer)
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
