# x402 Hydra Facilitator Documentation

Welcome to the comprehensive documentation for the x402 Hydra Facilitator project. This documentation is split into two main sections:

1. **[Facilitator Package](./facilitator-package/README.md)** - The npm package that provides payment verification and settlement functionality
2. **[NestJS Backend](./nestjs-backend/README.md)** - The production-ready backend application that uses the facilitator package

## What is x402 Hydra Facilitator?

The x402 Hydra Facilitator is an implementation of the [x402 Payment Protocol](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator) facilitator pattern. It simplifies payment verification and settlement between clients (buyers) and servers (sellers) by providing:

- **Payment Verification**: Confirm that client payment payloads meet server payment requirements
- **Payment Settlement**: Submit validated payments to the blockchain and monitor for confirmation
- **Multi-chain Support**: Works with both EVM and SVM (Solana) networks
- **Zero-custody**: Never holds funds, only facilitates onchain transactions

## Documentation Structure

### Facilitator Package Documentation

The facilitator package (`x402-hydra-facilitator`) is published to npm and provides the core functionality for verifying and settling payments.

**Quick Links:**
- [Package Overview](./facilitator-package/README.md) - Overview and quick start
- [Installation](./facilitator-package/installation.md) - Installation guide
- [API Reference](./facilitator-package/api-reference/) - Complete API documentation
  - [Core Functions](./facilitator-package/api-reference/core-functions.md) - `verify()` and `settle()`
  - [Client Creation](./facilitator-package/api-reference/client-creation.md) - Creating blockchain clients
  - [Types](./facilitator-package/api-reference/types.md) - TypeScript types and interfaces
  - [Configuration](./facilitator-package/api-reference/config.md) - Configuration options
  - [Schemes](./facilitator-package/api-reference/schemes.md) - Payment scheme implementations
- [Guides](./facilitator-package/guides/) - How-to guides
  - [Getting Started](./facilitator-package/guides/getting-started.md) - Step-by-step tutorial
  - [Verification](./facilitator-package/guides/verification.md) - Payment verification guide
  - [Settlement](./facilitator-package/guides/settlement.md) - Payment settlement guide
  - [EVM Networks](./facilitator-package/guides/evm-networks.md) - Working with EVM networks
  - [SVM Networks](./facilitator-package/guides/svm-networks.md) - Working with SVM networks
  - [Error Handling](./facilitator-package/guides/error-handling.md) - Error handling patterns
- [Examples](./facilitator-package/examples/) - Code examples
- [Architecture](./facilitator-package/architecture/) - Architecture documentation

### NestJS Backend Documentation

The NestJS backend application is a production-ready server that implements facilitator endpoints using the facilitator package.

**Quick Links:**
- [Backend Overview](./nestjs-backend/README.md) - Overview and quick start
- [Installation](./nestjs-backend/installation.md) - Setup and installation
- [Configuration](./nestjs-backend/configuration.md) - Environment variables and configuration
- [API Endpoints](./nestjs-backend/api-endpoints/) - HTTP endpoint documentation
  - [Verify](./nestjs-backend/api-endpoints/verify.md) - `POST /verify`
  - [Settle](./nestjs-backend/api-endpoints/settle.md) - `POST /settle`
  - [Supported](./nestjs-backend/api-endpoints/supported.md) - `GET /supported`
  - [Discovery](./nestjs-backend/api-endpoints/discovery.md) - Discovery layer endpoints
  - [Health](./nestjs-backend/api-endpoints/health.md) - Health check endpoints
- [Guides](./nestjs-backend/guides/) - Backend guides
  - [Deployment](./nestjs-backend/guides/deployment.md) - Production deployment
  - [Security](./nestjs-backend/guides/security.md) - Security features
  - [Observability](./nestjs-backend/guides/observability.md) - Logging, metrics, tracing
  - [Database](./nestjs-backend/guides/database.md) - Prisma and database setup
  - [Monitoring](./nestjs-backend/guides/monitoring.md) - Monitoring and health checks
- [Architecture](./nestjs-backend/architecture/) - Backend architecture
- [Examples](./nestjs-backend/examples/) - Request examples and integrations

## Getting Started

### For Package Users

If you want to use the facilitator package in your own application:

1. Read the [Package Overview](./facilitator-package/README.md)
2. Follow the [Getting Started Guide](./facilitator-package/guides/getting-started.md)
3. Check the [API Reference](./facilitator-package/api-reference/) for detailed documentation

### For Backend Developers

If you want to run or deploy the NestJS backend:

1. Read the [Backend Overview](./nestjs-backend/README.md)
2. Follow the [Installation Guide](./nestjs-backend/installation.md)
3. Review the [Configuration](./nestjs-backend/configuration.md) documentation
4. Check the [API Endpoints](./nestjs-backend/api-endpoints/) for endpoint details

## Supported Networks

### EVM Networks
- Base (`base`, `base-sepolia`)
- Polygon (`polygon`, `polygon-amoy`)
- Avalanche (`avalanche`, `avalanche-fuji`)
- Abstract (`abstract`, `abstract-testnet`)
- Sei (`sei`, `sei-testnet`)
- IoTeX (`iotex`)
- Peaq (`peaq`)

### SVM Networks
- Solana (`solana`, `solana-devnet`)

## Related Resources

- [x402 Protocol Specification](../specs/x402-specification.md) - The x402 protocol specification
- [Coinbase x402 Documentation](https://docs.cdp.coinbase.com/x402/core-concepts/facilitator) - Official x402 documentation
- [Package README](../README.md) - Package README with quick reference
- [NestJS Example README](../examples/nestjs/README.md) - Backend example README

## Contributing

Contributions are welcome! Please see the main repository for contribution guidelines.

## License

Licensed under the Apache License, Version 2.0.

