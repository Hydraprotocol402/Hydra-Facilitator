# Multi-stage Dockerfile for NestJS Facilitator
# Build context should be repository root (where pnpm-workspace.yaml exists)
#
# Usage:
#   docker build -f examples/nestjs/Dockerfile -t facilitator .
#   (from repo root)
#
# For low-memory servers (1GB RAM), use BUILD_MEMORY=1024 (requires swap space)
# For CI/CD or high-memory builds: docker build --build-arg BUILD_MEMORY=2048 ...
# For minimum memory builds on servers with swap: BUILD_MEMORY=768

# Build argument for memory allocation (default: 1024MB - minimum for TypeScript DTS generation)
ARG BUILD_MEMORY=1024

# Stage 1: Root package builder
FROM node:20-alpine AS root-builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /workspace

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json tsup.config.ts ./
COPY src ./src

# Install dependencies and build root package
# Memory allocation: Default 1024MB (minimum for TypeScript DTS generation), can override with BUILD_MEMORY arg
ARG BUILD_MEMORY=1024
ENV NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY}"
RUN pnpm install --frozen-lockfile && \
  pnpm build

# Stage 2: Install all dependencies (workspace-aware)
FROM node:20-alpine AS deps

RUN npm install -g pnpm

WORKDIR /workspace

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copy root package source (needed for workspace resolution)
COPY src ./src

# Copy examples directory to preserve workspace structure
COPY examples ./examples

# Copy built root package from previous stage
COPY --from=root-builder --chown=node:node /workspace/dist ./dist

# Install all dependencies
# Memory allocation: Default 1024MB (minimum for TypeScript DTS generation), can override with BUILD_MEMORY arg
ARG BUILD_MEMORY=1024
ENV NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY}"
RUN pnpm install --frozen-lockfile --prod=false

# Stage 3: Build NestJS application
FROM node:20-alpine AS app-builder

RUN npm install -g pnpm

WORKDIR /workspace

# Copy workspace configuration and dependencies
COPY --from=deps --chown=node:node /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=deps --chown=node:node /workspace/dist ./dist
COPY --from=deps --chown=node:node /workspace/node_modules ./node_modules

# Copy NestJS app source
COPY examples/nestjs ./examples/nestjs

# Build NestJS app
WORKDIR /workspace/examples/nestjs
# Memory allocation: Default 1024MB (minimum for TypeScript compilation), can override with BUILD_MEMORY arg
# Skip prebuild script since root package is already built (dist exists)
ARG BUILD_MEMORY=1024
ENV NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY}"
# Use nest build directly to skip prebuild hook
RUN pnpm exec nest build

# Stage 4: Production runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy workspace configuration files (needed for workspace dependency resolution)
COPY --from=app-builder --chown=node:node /workspace/package.json /workspace/pnpm-workspace.yaml /workspace/pnpm-lock.yaml ./

# Copy built root package
COPY --from=app-builder --chown=node:node /workspace/dist ./dist

# Copy examples directory structure (including built NestJS dist)
COPY --from=app-builder --chown=node:node /workspace/examples ./examples

# Copy node_modules from build stage (includes all workspace links correctly established)
# This approach:
# - Ensures workspace dependencies ("x402": "file:../..") are correctly linked
# - Avoids reinstallation errors in production
# - Matches exactly what was built and tested
# - Eliminates "Cannot find module" errors
# Note: Includes dev dependencies but ensures reliability and zero build work on server
COPY --from=app-builder --chown=node:node /workspace/node_modules ./node_modules

# Set working directory to NestJS app
WORKDIR /app/examples/nestjs

# Switch to non-root user
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]
