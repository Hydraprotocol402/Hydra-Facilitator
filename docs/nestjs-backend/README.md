# NestJS Backend

A production-ready NestJS backend server implementation of the x402 facilitator protocol, providing HTTP endpoints for verifying and settling payments.

## Overview

This NestJS application provides a complete facilitator service with:

- **Payment Verification**: `POST /verify` - Verifies payment payloads
- **Payment Settlement**: `POST /settle` - Settles verified payments on blockchain
- **Supported Networks**: `GET /supported` - Lists supported payment schemes and networks
- **Discovery Layer**: `GET /discovery/resources` - Lists discoverable x402-enabled resources
- **Health Checks**: `GET /health` - Health check endpoints for monitoring

## Features

- ✅ **Security**: Helmet for security headers, configurable CORS, rate limiting
- ✅ **Observability**: Structured logging with Pino, request correlation IDs
- ✅ **Reliability**: Health checks, request timeouts, error handling
- ✅ **Production-Ready**: Environment-based configuration, proper error responses
- ✅ **Discovery Layer**: Automatic resource registration and discovery
- ✅ **Metrics & Monitoring**: Performance metrics, tracing, and health monitoring

## Quick Start

### Prerequisites

- Node.js v24 or higher
- pnpm (recommended) or npm
- PostgreSQL database (for discovery layer functionality)

### Installation

1. **Install dependencies**:
   ```bash
   cd examples/nestjs
   pnpm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database** (if using discovery layer):
   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   ```

4. **Start the server**:
   ```bash
   pnpm start:dev  # Development mode
   # or
   pnpm build && pnpm start:prod  # Production mode
   ```

See [Installation Guide](./installation.md) for detailed setup instructions.

## API Endpoints

### Facilitator Endpoints

- **POST /verify** - Verify payment payloads
- **POST /settle** - Settle verified payments
- **GET /supported** - Get supported payment kinds

### Discovery Endpoints

- **GET /discovery/resources** - List discoverable resources
- **GET /list** - Alias for `/discovery/resources` (redirects)

### Health Endpoints

- **GET /health** - Health check
- **GET /health/ready** - Readiness probe
- **GET /health/live** - Liveness probe

See [API Endpoints Documentation](./api-endpoints/) for detailed endpoint documentation.

## Configuration

The backend uses environment variables for configuration:

- **Private Keys**: `EVM_PRIVATE_KEY`, `SVM_PRIVATE_KEY`
- **RPC URLs**: `EVM_RPC_URL`, `SVM_RPC_URL`
- **Database**: `DATABASE_URL` (for discovery layer)
- **Server**: `PORT`, `NODE_ENV`
- **Security**: `CORS_ORIGINS`, `ENABLE_CORS`, `ALLOWED_NETWORKS`
- **Rate Limiting**: `RATE_LIMIT_*` variables

See [Configuration Documentation](./configuration.md) for all environment variables.

## Project Structure

```
src/
├── main.ts                           # Application entry point
├── app.module.ts                     # Root module
├── config/                           # Configuration module
├── facilitator/                      # Facilitator endpoints
├── discovery/                        # Discovery layer
├── common/                           # Shared modules
│   ├── filters/                     # Exception filters
│   ├── guards/                      # Guards (rate limiting, API key)
│   ├── interceptors/                # Interceptors (logging, metrics)
│   ├── metrics/                     # Metrics collection
│   ├── performance/                 # Performance monitoring
│   ├── prisma/                      # Database client
│   └── tracing/                     # Distributed tracing
└── prisma/
    └── schema.prisma                 # Database schema
```

See [Architecture Documentation](./architecture/) for detailed structure documentation.

## Development

### Running in Development

```bash
pnpm start:dev
```

### Building for Production

```bash
pnpm build
pnpm start:prod
```

### Running Tests

```bash
pnpm test
```

## Deployment

The backend is production-ready and can be deployed to:

- Docker containers
- Kubernetes clusters
- Cloud platforms (AWS, GCP, Azure)
- Traditional servers

See [Deployment Guide](./guides/deployment.md) for detailed deployment instructions.

## Documentation

### API Documentation

- [Verify Endpoint](./api-endpoints/verify.md)
- [Settle Endpoint](./api-endpoints/settle.md)
- [Supported Endpoint](./api-endpoints/supported.md)
- [Discovery Endpoints](./api-endpoints/discovery.md)
- [Health Endpoints](./api-endpoints/health.md)

### Guides

- [Installation](./installation.md) - Setup and installation
- [Configuration](./configuration.md) - Environment variables
- [Deployment](./guides/deployment.md) - Production deployment
- [Security](./guides/security.md) - Security features
- [Observability](./guides/observability.md) - Logging, metrics, tracing
- [Database](./guides/database.md) - Prisma and database setup
- [Monitoring](./guides/monitoring.md) - Monitoring and health checks

### Architecture

- [Structure](./architecture/structure.md) - Project structure
- [Modules](./architecture/modules.md) - NestJS modules overview
- [Services](./architecture/services.md) - Service layer documentation

### Examples

- [Request Examples](./examples/request-examples.md) - Example API requests
- [Integration Examples](./examples/integration.md) - Integration examples

## Related Resources

- [Facilitator Package Documentation](../facilitator-package/README.md) - The npm package used by this backend
- [Main Documentation](../README.md) - Main documentation index
- [NestJS Example README](../../examples/nestjs/README.md) - Example README with quick reference

## License

Licensed under the Apache License, Version 2.0.

