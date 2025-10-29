# Deployment Guide for NestJS Facilitator

This NestJS app is part of a pnpm monorepo and depends on the root package. Here are two deployment options:

## Option 1: Configure Coolify to Build from Repository Root (Recommended)

In Coolify's deployment settings:

1. **Build Context**: Set to the repository root (`/`)
2. **Dockerfile Path** (if using): Leave empty or use `examples/nestjs/nixpacks.toml`
3. **Working Directory**: Set to `examples/nestjs` (or leave empty, nixpacks will handle it)

This ensures the entire monorepo is available during the build process.

## Option 2: Current Configuration (Build from examples/nestjs)

The current `nixpacks.toml` attempts to find the repository root automatically by:

1. First checking if parent directories are accessible from `/app`
2. Falling back to searching `/artifacts` for the cloned repository
3. Building from the found root, then building the NestJS app

**Note**: This requires that Coolify's build process has access to the full repository in `/artifacts` during the build phase.

## Environment Variables Required

Set these in Coolify's environment variables:

- `EVM_PRIVATE_KEY` (hex string) - For EVM network operations
- `SVM_PRIVATE_KEY` (base58 string) - For Solana network operations
- `PORT` (optional, default: 3000) - Server port
- `NODE_ENV` (optional, default: production)

See `.env.example` for all available configuration options.

## Verification

After deployment, check:
- `GET /health` - Health check endpoint
- `GET /supported` - List supported payment schemes/networks
- `POST /verify` - Test payment verification
- `POST /settle` - Test payment settlement

