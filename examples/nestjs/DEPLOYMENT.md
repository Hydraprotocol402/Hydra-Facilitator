# Deployment Guide for NestJS Facilitator

This NestJS app is part of a pnpm monorepo and **requires** the repository root to be available during build because it depends on the root package (`"x402": "file:../.."`).

## ⚠️ Required: Configure Coolify Build Context

**You MUST configure Coolify to build from the repository root, not from `examples/nestjs`.**

### Steps to Fix in Coolify:

1. Go to your deployment settings in Coolify
2. Find **"Build Context"** or **"Root Directory"** setting
3. **Set it to the repository root** (should be empty `/` or `.`)
4. **DO NOT** set it to `examples/nestjs` - that will fail!

Alternatively, if Coolify has a "Dockerfile/Config Path" setting:
- Set **Build Context** to: `/` (repo root)
- Set **Config Path** to: `examples/nestjs/nixpacks.toml` (if supported)

### Why?

The NestJS app depends on the root package via `file:../..`. Without access to the repository root:
- Dependencies cannot be installed (`pnpm install` fails)
- The root package cannot be built
- The NestJS app cannot be built

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

