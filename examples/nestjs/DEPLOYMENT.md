# Deployment Guide for NestJS Facilitator

This NestJS app is part of a pnpm monorepo and **requires** the repository root to be available during build because it depends on the root package (`"x402": "file:../.."`).

## Docker Build

The application uses a multi-stage Dockerfile that builds the root package and NestJS app separately.

### Build Context

**You MUST configure your build context to the repository root** (where `pnpm-workspace.yaml` exists), not from `examples/nestjs`.

### Coolify Configuration

1. Go to your deployment settings in Coolify
2. Find **"Build Context"** or **"Root Directory"** setting
3. **Set it to the repository root** (should be empty `/` or `.`)
4. Set **Dockerfile Path** to: `examples/nestjs/Dockerfile`

### Manual Docker Build

From the repository root:

```bash
docker build -f examples/nestjs/Dockerfile -t facilitator:latest .
```

### Docker Build Process

The Dockerfile uses a multi-stage build:

1. **root-builder**: Builds the root x402 package
2. **deps**: Installs all workspace dependencies
3. **app-builder**: Builds the NestJS application
4. **runtime**: Minimal production image with only necessary files

### Why Repository Root?

The NestJS app depends on the root package via `file:../..`. Without access to the repository root:
- Dependencies cannot be installed (`pnpm install` fails)
- The root package cannot be built
- The NestJS app cannot be built

## Environment Variables

Set these in Coolify's environment variables (or via `.env` file):

**Required:**
- `EVM_PRIVATE_KEY` (hex string) - For EVM network operations, OR
- `SVM_PRIVATE_KEY` (base58 string) - For Solana network operations

**Optional:**
- `PORT` (default: 3000) - Server port
- `NODE_ENV` (default: production)
- `SVM_RPC_URL` - Custom Solana RPC URL
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `ENABLE_CORS` (default: true)
- `RATE_LIMIT_TTL` (default: 60) - Rate limit window in seconds
- `RATE_LIMIT_VERIFY` (default: 100) - Max requests per window for /verify
- `RATE_LIMIT_SETTLE` (default: 50) - Max requests per window for /settle
- `RATE_LIMIT_SUPPORTED` (default: 200) - Max requests per window for /supported

Additional optional controls:
- `ALLOWED_NETWORKS` - Comma-separated allowlist of networks for verify/settle and /supported. Example: `base-sepolia,solana-devnet`. If unset/empty, all supported networks for which private keys are configured are allowed by default.

See `.env.example` for all available configuration options.

## Verification

After deployment, check these endpoints:

- `GET /health` - Health check endpoint
- `GET /supported` - List supported payment schemes/networks
- `POST /verify` - Test payment verification
- `POST /settle` - Test payment settlement

## Troubleshooting

### Build Fails: "Cannot find pnpm-workspace.yaml"

**Solution**: Ensure build context is set to repository root, not `examples/nestjs`.

### Build Fails: "Cannot find module 'x402'"

**Solution**: The root package must be built first. Ensure the Dockerfile stages execute in order and the workspace structure is preserved.

### Runtime Error: "At least one of EVM_PRIVATE_KEY or SVM_PRIVATE_KEY must be set"

**Solution**: Set at least one private key environment variable in your deployment platform.
