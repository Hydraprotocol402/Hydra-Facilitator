# Configuration

Complete reference for all environment variables and configuration options in the NestJS backend.

## Required Configuration

### Private Keys

At least one private key must be configured:

```env
# EVM private key (hex string starting with 0x)
EVM_PRIVATE_KEY=0x1234567890abcdef...

# OR SVM private key (base58 encoded string)
SVM_PRIVATE_KEY=base58encodedprivatekey...
```

The backend validates that at least one is set on startup.

## Database Configuration

### DATABASE_URL

PostgreSQL connection string (required for discovery layer):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/x402_facilitator
```

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]`

## Server Configuration

### PORT

Server port (default: `3000`):

```env
PORT=3000
```

### NODE_ENV

Environment mode (default: `development`):

```env
NODE_ENV=production
```

Valid values: `development`, `production`, `test`

## RPC Configuration

### EVM_RPC_URL

Custom RPC URL for EVM networks:

```env
EVM_RPC_URL=https://custom-evm-rpc.example.com
```

If not set, uses default RPC URLs from chain definitions.

### SVM_RPC_URL

Custom RPC URL for Solana networks:

```env
SVM_RPC_URL=https://custom-solana-rpc.example.com
```

If not set, uses default Solana RPC endpoints.

## Security Configuration

### CORS_ORIGINS

Comma-separated list of allowed CORS origins:

```env
CORS_ORIGINS=https://example.com,https://api.example.com
```

If not set, CORS is enabled for all origins (not recommended for production).

### ENABLE_CORS

Enable or disable CORS (default: `true`):

```env
ENABLE_CORS=true
```

### ALLOWED_NETWORKS

Comma-separated list of allowed networks:

```env
ALLOWED_NETWORKS=base-sepolia,polygon-amoy,solana-devnet
```

If not set, all supported networks are allowed.

### ALLOW_LOCALHOST_RESOURCES

Allow localhost/private IP resources in discovery (default: `false`):

```env
ALLOW_LOCALHOST_RESOURCES=false
```

Set to `true` for development/testing only.

## Rate Limiting

### RATE_LIMIT_TTL

Rate limit window in seconds (default: `60`):

```env
RATE_LIMIT_TTL=60
```

### RATE_LIMIT_VERIFY

Max requests per window for `/verify` (default: `100`):

```env
RATE_LIMIT_VERIFY=100
```

### RATE_LIMIT_SETTLE

Max requests per window for `/settle` (default: `50`):

```env
RATE_LIMIT_SETTLE=50
```

### RATE_LIMIT_SUPPORTED

Max requests per window for `/supported` (default: `200`):

```env
RATE_LIMIT_SUPPORTED=200
```

### RATE_LIMIT_DISCOVERY

Max requests per window for `/discovery/resources` (default: `200`):

```env
RATE_LIMIT_DISCOVERY=200
```

## Gas Balance Monitoring

### GAS_BALANCE_THRESHOLD_EVM

EVM gas balance threshold in ETH (default: `0.01`):

```env
GAS_BALANCE_THRESHOLD_EVM=0.01
```

Triggers alerts when EVM signer balance falls below this threshold.

### GAS_BALANCE_THRESHOLD_SVM

SVM gas balance threshold in SOL (default: `0.1`):

```env
GAS_BALANCE_THRESHOLD_SVM=0.1
```

Triggers alerts when SVM signer balance falls below this threshold.

## Alert Testing (Optional)

### ALERT_TEST_API_KEY

API key for testing alert endpoints:

```env
ALERT_TEST_API_KEY=your-secret-test-key
```

Used to access `/health/test/*` endpoints for testing alerts.

## Configuration Service

The backend uses a `ConfigService` to access configuration:

```typescript
import { ConfigService } from './config/config.service';

// Access configuration values
const evmPrivateKey = configService.evmPrivateKey;
const port = configService.port;
const corsOrigins = configService.corsOrigins;
```

## Configuration Validation

The backend validates configuration on startup:

```typescript
// Ensures at least one private key is set
configService.validate();
```

## Environment File Example

Complete `.env` example:

```env
# Required: At least one private key
EVM_PRIVATE_KEY=0x...
# SVM_PRIVATE_KEY=base58...

# Database (required for discovery)
DATABASE_URL=postgresql://user:password@localhost:5432/x402_facilitator

# Server
PORT=3000
NODE_ENV=production

# RPC URLs (optional)
EVM_RPC_URL=https://custom-evm-rpc.example.com
SVM_RPC_URL=https://custom-solana-rpc.example.com

# Security
CORS_ORIGINS=https://example.com,https://api.example.com
ENABLE_CORS=true
ALLOWED_NETWORKS=base-sepolia,polygon-amoy
ALLOW_LOCALHOST_RESOURCES=false

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_VERIFY=100
RATE_LIMIT_SETTLE=50
RATE_LIMIT_SUPPORTED=200
RATE_LIMIT_DISCOVERY=200

# Gas Balance Monitoring
GAS_BALANCE_THRESHOLD_EVM=0.01
GAS_BALANCE_THRESHOLD_SVM=0.1

# Alert Testing (optional)
ALERT_TEST_API_KEY=your-secret-key
```

## Production Recommendations

1. **Use environment-specific files**: Use `.env.production` for production
2. **Secure private keys**: Store private keys in secure secret management
3. **Restrict CORS**: Set specific CORS origins for production
4. **Network restrictions**: Use `ALLOWED_NETWORKS` to restrict supported networks
5. **Custom RPC URLs**: Use dedicated RPC endpoints for better performance
6. **Rate limiting**: Adjust rate limits based on expected load
7. **Database**: Use managed PostgreSQL for production
8. **Monitoring**: Set up monitoring for gas balance thresholds

## See Also

- [Installation Guide](./installation.md) - Setup instructions
- [Deployment Guide](./guides/deployment.md) - Production deployment
- [Security Guide](./guides/security.md) - Security best practices

