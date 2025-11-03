# Installation

This guide covers installing and setting up the NestJS backend application.

## Prerequisites

- Node.js v24 or higher
- pnpm (recommended) or npm
- PostgreSQL database (for discovery layer functionality)

## Step 1: Install Dependencies

Navigate to the NestJS example directory:

```bash
cd examples/nestjs
```

Install dependencies:

```bash
pnpm install
# or
npm install
```

## Step 2: Environment Configuration

Create a `.env` file in the `examples/nestjs` directory:

```bash
cp .env.example .env  # If .env.example exists
# or create .env manually
```

Configure at least one of the following:

```env
# At least one private key is required
EVM_PRIVATE_KEY=0x...  # Hex string for EVM networks
SVM_PRIVATE_KEY=base58...  # Base58 string for Solana networks

# Database (required for discovery layer)
DATABASE_URL=postgresql://user:password@localhost:5432/x402_facilitator

# Optional: Custom RPC URLs
EVM_RPC_URL=https://custom-evm-rpc.example.com
SVM_RPC_URL=https://custom-solana-rpc.example.com

# Server configuration
PORT=3000
NODE_ENV=development

# Security
CORS_ORIGINS=https://example.com,https://api.example.com
ENABLE_CORS=true
ALLOWED_NETWORKS=base-sepolia,polygon-amoy  # Optional: restrict networks

# Rate limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_VERIFY=100
RATE_LIMIT_SETTLE=50
RATE_LIMIT_SUPPORTED=200
RATE_LIMIT_DISCOVERY=200
```

See [Configuration Documentation](./configuration.md) for all environment variables.

## Step 3: Database Setup

If using the discovery layer, set up PostgreSQL:

### Create Database

```bash
# Using psql
createdb x402_facilitator

# Or using SQL
psql -U postgres -c "CREATE DATABASE x402_facilitator;"
```

### Run Migrations

```bash
# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate

# Or in development
pnpm prisma:migrate:dev
```

## Step 4: Build Parent Package

If using the workspace setup, build the parent package:

```bash
cd ../..
pnpm build
```

## Step 5: Start the Server

### Development Mode

```bash
pnpm start:dev
```

The server will start on `http://localhost:3000` (or your configured PORT).

### Production Mode

```bash
pnpm build
pnpm start:prod
```

## Verification

Test that the server is running:

```bash
curl http://localhost:3000/health
```

You should receive a health check response:

```json
{
  "status": "ok",
  "info": {
    "memory_heap": { "status": "up" },
    "memory_rss": { "status": "up" }
  }
}
```

## Next Steps

- [Configuration](./configuration.md) - Configure all environment variables
- [API Endpoints](./api-endpoints/) - Learn about available endpoints
- [Deployment Guide](./guides/deployment.md) - Deploy to production

## Troubleshooting

### "At least one private key must be set"

Ensure at least one of `EVM_PRIVATE_KEY` or `SVM_PRIVATE_KEY` is set in your `.env` file.

### Database Connection Errors

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check database permissions

### Port Already in Use

Change the `PORT` environment variable or stop the process using the port.

### Module Not Found Errors

Ensure you've installed dependencies:
```bash
pnpm install
```

If using the workspace setup, ensure the parent package is built:
```bash
cd ../..
pnpm build
```

## See Also

- [Configuration](./configuration.md) - Complete configuration reference
- [API Endpoints](./api-endpoints/) - Endpoint documentation
- [Deployment Guide](./guides/deployment.md) - Production deployment

