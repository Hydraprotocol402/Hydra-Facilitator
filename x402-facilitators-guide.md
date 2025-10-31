# x402 Facilitators: Complete Technical Reference

## Table of Contents
1. [Protocol Overview](#protocol-overview)
2. [Facilitator Architecture](#facilitator-architecture)
3. [Core Endpoints Specification](#core-endpoints-specification)
4. [Payment Verification](#payment-verification)
5. [Settlement Implementation](#settlement-implementation)
6. [Chain-Specific Implementation](#chain-specific-implementation)
7. [Security Considerations](#security-considerations)
8. [TypeScript Implementation Patterns](#typescript-implementation-patterns)
9. [Production Deployment](#production-deployment)

---

## Protocol Overview

### Fundamental Concept

x402 transforms the dormant HTTP 402 "Payment Required" status code into a native payment layer for APIs and services. The protocol enables:

- **Frictionless payments**: No accounts, API keys, or KYC required
- **Sub-second settlement**: ~200ms on Base, <1s on Solana
- **Gasless transfers**: EIP-3009 authorizations or SPL token signatures
- **Blockchain-agnostic**: Works with any EIP-3009 token on EVM or SPL tokens on Solana

### Protocol Version

Current stable: **V1** (scheme: `exact`)

### Key Design Principles

1. **Scheme-agnostic**: Payment logic is pluggable (currently `exact`, future: `upto`, `deferred`)
2. **Network-pluggable**: Different settlement mechanisms per blockchain
3. **Facilitator-optional**: Servers can verify/settle directly or delegate to facilitator
4. **Trust-minimizing**: Payments signed by payer; facilitator cannot move funds arbitrarily

---

## Facilitator Architecture

### Role Definition

A facilitator is a stateless service that:
- **Verifies** payment payloads via cryptographic signature validation
- **Settles** payments on-chain by broadcasting transactions
- **Confirms** payments after blockchain confirmation
- **Does NOT** hold funds or custody assets

### Facilitator Responsibilities

```
┌─────────────┐
│   Client    │ Signs payment (EIP-712 or Ed25519)
└──────┬──────┘
       │
       │ X-PAYMENT header
       ▼
┌─────────────────────┐
│ Resource Server     │
│  (Seller)           │ Receives payment proof
└──────┬──────────────┘
       │
       │ POST /verify
       ▼
┌─────────────────────┐
│   FACILITATOR       │
├─────────────────────┤
│ 1. Signature verify │ ◄─── Cryptographic validation
│ 2. Amount check     │ ◄─── ≤ maxAmountRequired
│ 3. Nonce tracking   │ ◄─── Replay attack prevention
│ 4. Timestamp valid  │ ◄─── Expiry enforcement
└──────┬──────────────┘
       │ VerificationResponse
       ▼
┌─────────────────────┐
│ Resource Server     │
│ (if verified)       │
│ POST /settle        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   FACILITATOR       │
├─────────────────────┤
│ 1. Build TX         │
│ 2. Sign with signer │
│ 3. Broadcast        │
│ 4. Poll confirmations│
└──────┬──────────────┘
       │ confirmation
       ▼
     Blockchain
```

### Facilitator State Management

Facilitators should be **stateless** in principle but require:

1. **Nonce tracking** (in-memory with TTL or Redis):
   - Map: `{chainId}:{nonce} → timestamp`
   - TTL: ~5 minutes (after which replay is impractical)

2. **Rate limiting** (per-payer or global):
   - Prevent DoS via high-frequency payment attempts
   - Track by `payer_address` + `chainId` + `1min_window`

3. **RPC connection pool**:
   - One per supported network
   - Automatic failover / round-robin

4. **Signer wallet** (never exposed to public):
   - Private key management (ENV vars / HSM)
   - Used only to broadcast settlement transactions
   - Must have native token for gas (or use sponsor pattern)

---

## Core Endpoints Specification

### Endpoint: POST /verify

**Purpose**: Cryptographically validate a payment payload without broadcasting to blockchain.

#### Request

```json
{
  "x402Version": 1,
  "paymentHeader": "base64_encoded_payment_payload",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000",
    "resource": "https://api.example.com/data",
    "description": "Access to premium data",
    "mimeType": "application/json",
    "payTo": "0xRecipientAddress",
    "maxTimeoutSeconds": 60,
    "asset": "0xA0b86991C6218b36c1d19D4a2e9Eb0cE3606EB48",
    "extra": {
      "name": "USDC",
      "version": "2"
    }
  }
}
```

#### Response Success

```json
{
  "isValid": true,
  "invalidReason": null
}
```

#### Response Failure

```json
{
  "isValid": false,
  "invalidReason": "Signature verification failed: recovered address does not match payer"
}
```

#### Verification Logic (TypeScript)

```typescript
async verifyPayment(
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<VerificationResponse> {
  try {
    // Decode base64 payload
    const payload = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8')
    );

    // 1. Check scheme & network support
    if (!this.supportedSchemes.includes(payload.scheme)) {
      return { isValid: false, invalidReason: "Unsupported scheme" };
    }
    if (!this.supportedNetworks.includes(payload.network)) {
      return { isValid: false, invalidReason: "Unsupported network" };
    }

    // 2. Validate amount
    const maxAmount = BigInt(requirements.maxAmountRequired);
    const paymentAmount = BigInt(payload.payload.amount);
    if (paymentAmount > maxAmount) {
      return {
        isValid: false,
        invalidReason: "Amount exceeds maximum"
      };
    }

    // 3. Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.payload.validBefore < now) {
      return { isValid: false, invalidReason: "Payment expired" };
    }

    // 4. Verify nonce uniqueness (replay prevention)
    const nonceKey = `${payload.network}:${payload.payload.nonce}`;
    if (await this.nonceCache.exists(nonceKey)) {
      return { isValid: false, invalidReason: "Nonce already used" };
    }

    // 5. Signature verification (scheme-specific)
    const isValid = await this.verifySignature(
      payload,
      requirements,
      payload.network
    );

    if (!isValid) {
      return { isValid: false, invalidReason: "Invalid signature" };
    }

    // 6. Mark nonce as used (TTL 5 min)
    await this.nonceCache.set(nonceKey, true, 300);

    return { isValid: true, invalidReason: null };
  } catch (error) {
    return {
      isValid: false,
      invalidReason: `Verification error: ${error.message}`
    };
  }
}
```

### Endpoint: POST /settle

**Purpose**: Execute on-chain settlement of a verified payment.

#### Request

```json
{
  "x402Version": 1,
  "paymentHeader": "base64_encoded_payment_payload",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000",
    "resource": "https://api.example.com/data",
    "payTo": "0xRecipientAddress",
    "asset": "0xA0b86991C6218b36c1d19D4a2e9Eb0cE3606EB48",
    "extra": { "name": "USDC", "version": "2" }
  }
}
```

#### Response Success

```json
{
  "success": true,
  "error": null,
  "txHash": "0x1234567890abcdef...",
  "networkId": "base-sepolia"
}
```

#### Response Failure

```json
{
  "success": false,
  "error": "Insufficient balance in payer account",
  "txHash": null,
  "networkId": "base-sepolia"
}
```

#### Settlement Logic (TypeScript)

```typescript
async settlePayment(
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<SettlementResponse> {
  try {
    const payload = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8')
    );

    // 1. Re-verify before settlement
    const verifyResult = await this.verifyPayment(paymentHeader, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        error: verifyResult.invalidReason,
        txHash: null,
        networkId: payload.network
      };
    }

    // 2. Get provider for network
    const provider = this.getProvider(payload.network);
    if (!provider) {
      return {
        success: false,
        error: "Unsupported network",
        txHash: null,
        networkId: payload.network
      };
    }

    // 3. Build settlement transaction (scheme-specific)
    const tx = await this.buildSettlementTx(
      payload,
      requirements,
      payload.network
    );

    // 4. Sign transaction
    const signedTx = await this.signerWallet.signTransaction(tx);

    // 5. Broadcast to blockchain
    const txResponse = await provider.broadcastTransaction(signedTx);

    // 6. Wait for confirmation (configurable: 1-12 blocks)
    const receipt = await provider.waitForTransaction(
      txResponse.hash,
      this.confirmationBlocks
    );

    if (!receipt || receipt.status !== 1) {
      return {
        success: false,
        error: "Transaction failed on-chain",
        txHash: txResponse.hash,
        networkId: payload.network
      };
    }

    return {
      success: true,
      error: null,
      txHash: txResponse.hash,
      networkId: payload.network
    };
  } catch (error) {
    return {
      success: false,
      error: `Settlement error: ${error.message}`,
      txHash: null,
      networkId: payload.network
    };
  }
}
```

### Endpoint: GET /supported

**Purpose**: Advertise supported payment schemes and networks.

#### Response

```json
{
  "kinds": [
    {
      "scheme": "exact",
      "network": "base-sepolia"
    },
    {
      "scheme": "exact",
      "network": "base"
    },
    {
      "scheme": "exact",
      "network": "solana-devnet"
    },
    {
      "scheme": "exact",
      "network": "solana"
    }
  ]
}
```

#### Implementation (TypeScript)

```typescript
async getSupported(): Promise<SupportedResponse> {
  const kinds = [];

  // Cartesian product: all schemes × all networks
  for (const scheme of this.supportedSchemes) {
    for (const network of this.supportedNetworks) {
      kinds.push({ scheme, network });
    }
  }

  return { kinds };
}
```

---

## Payment Verification

### EIP-712 Signature Verification (EVM)

The `exact` scheme on EVM uses **EIP-3009 `TransferWithAuthorization`** with **EIP-712** typed data signing.

#### EIP-712 Domain Structure

```typescript
interface EIP712Domain {
  name: string;           // "USDC"
  version: string;        // "2"
  chainId: number;        // 84532 for Base Sepolia
  verifyingContract: string; // USDC contract address
}
```

#### Payment Payload Structure (EVM)

```typescript
interface TransferWithAuthorizationPayload {
  from: string;           // Payer address
  to: string;             // Recipient (facilitator or direct)
  value: string;          // Amount in atomic units (BigInt as string)
  validAfter: number;     // Unix timestamp - when authorization becomes valid
  validBefore: number;    // Unix timestamp - when authorization expires
  nonce: string;          // Bytes32 hex nonce (prevents replay)
}
```

#### Verification Algorithm

```typescript
async verifyEVMSignature(
  payload: any,
  requirements: PaymentRequirements,
  signature: string
): Promise<boolean> {
  const { from, to, value, validAfter, validBefore, nonce } = payload.payload;

  // 1. Reconstruct EIP-712 domain separator
  const domain = {
    name: requirements.extra.name,
    version: requirements.extra.version,
    chainId: this.chainIdMap[requirements.network],
    verifyingContract: requirements.asset
  };

  // 2. Define the type hash for TransferWithAuthorization
  const typeHash = keccak256(
    toUtf8Bytes(
      "TransferWithAuthorization(address from,address to,uint256 value," +
      "uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    )
  );

  // 3. Build the struct hash
  const structHash = keccak256(
    defaultAbiCoder.encode(
      [
        "bytes32",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "bytes32"
      ],
      [typeHash, from, to, value, validAfter, validBefore, nonce]
    )
  );

  // 4. Build domain separator
  const domainSeparator = keccak256(
    defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [
        keccak256(toUtf8Bytes("EIP712Domain(string name,string version," +
          "uint256 chainId,address verifyingContract)")),
        keccak256(toUtf8Bytes(domain.name)),
        keccak256(toUtf8Bytes(domain.version)),
        domain.chainId,
        domain.verifyingContract
      ]
    )
  );

  // 5. Build EIP-191 prefix message hash
  const messageHash = keccak256(
    concat([
      "0x1901",
      domainSeparator,
      structHash
    ])
  );

  // 6. Recover signer address
  const recoveredAddress = recoverAddress(messageHash, signature);

  // 7. Verify signer is the payer
  return recoveredAddress.toLowerCase() === from.toLowerCase();
}
```

### Amount Validation (EVM)

USDC on Base uses **6 decimal places**. Price strings like `"$0.01"` must be converted:

```typescript
function parseUSDCPrice(priceString: string): BigInt {
  // Strip currency symbol
  const amount = parseFloat(priceString.replace('$', ''));
  
  // USDC: 6 decimals
  // $0.01 → 10000 atomic units
  return BigInt(Math.round(amount * 1_000_000));
}

// Example
const price = "$0.10";  // 100000 (atomic units)
const atomicAmount = parseUSDCPrice(price);
```

---

## Settlement Implementation

### EVM Settlement (Base, Avalanche, Polygon, etc.)

#### Transaction Building

```typescript
async buildEVMSettlementTx(
  payload: any,
  requirements: PaymentRequirements,
  network: string
): Promise<Transaction> {
  const { from, to, value, validAfter, validBefore, nonce } = payload.payload;
  const provider = this.getProvider(network);
  const contract = new Contract(
    requirements.asset,
    USDC_ABI, // ERC-3009 compatible ABI
    provider
  );

  // Decode signature (r, s, v format)
  const sig = payload.payload.signature;
  const r = "0x" + sig.slice(2, 66);
  const s = "0x" + sig.slice(66, 130);
  const v = parseInt("0x" + sig.slice(130, 132), 16);

  // Build transferWithAuthorization call
  const tx = await contract.populateTransaction.transferWithAuthorization(
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s
  );

  // Set gas limit (typical: 100k-150k)
  tx.gasLimit = BigInt(150000);

  // Get current gas price
  const gasPrice = await provider.getGasPrice();
  tx.gasPrice = gasPrice;

  return tx;
}
```

#### Confirmation Polling

```typescript
async waitForConfirmation(
  txHash: string,
  provider: ethers.Provider,
  confirmations: number = 3,
  maxWaitSeconds: number = 120
): Promise<TransactionReceipt | null> {
  const startTime = Date.now();

  while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (receipt) {
      if (receipt.confirmations >= confirmations) {
        return receipt;
      }
    }

    // Poll every 5 seconds on Base (12s block time)
    await new Promise(r => setTimeout(r, 5000));
  }

  return null; // Timeout
}
```

### Solana Settlement

#### Transaction Building (SPL Tokens)

```typescript
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getMint
} from "@solana/spl-token";

async function buildSolanaSettlementTx(
  payload: any,
  requirements: PaymentRequirements,
  connection: Connection
): Promise<Transaction> {
  const {
    payer,
    payerTokenAccount,
    recipientTokenAccount,
    amount,
    decimals
  } = payload.payload;

  const transaction = new Transaction();

  // For SPL tokens
  transaction.add(
    createTransferCheckedInstruction(
      new PublicKey(payerTokenAccount),
      new PublicKey(requirements.asset), // Mint address
      new PublicKey(recipientTokenAccount),
      new PublicKey(payer),
      BigInt(amount),
      decimals
    )
  );

  // Set recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(this.facilitatorSigner.publicKey);

  return transaction;
}
```

#### Signature Verification (Solana)

```typescript
import nacl from "tweetnacl";
import { bs58 } from "@project-serum/anchor";

function verifySolanaSignature(
  message: Buffer,
  signature: Buffer,
  publicKeyString: string
): boolean {
  const publicKey = bs58.decode(publicKeyString);
  return nacl.sign.detached.verify(message, signature, publicKey);
}
```

---

## Chain-Specific Implementation

### Base / Base Sepolia (EVM)

| Property | Value |
|----------|-------|
| **Chain ID (testnet)** | 84532 |
| **Chain ID (mainnet)** | 8453 |
| **USDC Address (testnet)** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| **USDC Address (mainnet)** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| **Decimals** | 6 |
| **Typical Block Time** | 2 seconds |
| **Confirmation Target** | 1-3 blocks (~2-6 seconds) |

#### Configuration (TypeScript)

```typescript
const BaseConfig = {
  testnet: {
    chainId: 84532,
    rpcUrl: "https://base-sepolia.g.alchemy.com/v2/KEY",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    name: "USDC",
    eip712Version: "2",
    explorerUrl: "https://sepolia.basescan.org"
  },
  mainnet: {
    chainId: 8453,
    rpcUrl: "https://base-mainnet.g.alchemy.com/v2/KEY",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USDC",
    eip712Version: "2",
    explorerUrl: "https://basescan.org"
  }
};
```

### Avalanche (EVM)

| Property | Value |
|----------|-------|
| **Chain ID (Fuji)** | 43113 |
| **Chain ID (C-Chain)** | 43114 |
| **USDC Address (Fuji)** | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| **USDC Address (C-Chain)** | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| **Decimals** | 6 |
| **Block Time** | ~2 seconds |
| **Confirmation Target** | 1-3 blocks |

### Solana / Solana Devnet

| Property | Value |
|----------|-------|
| **Chain ID (mainnet)** | 101 |
| **Chain ID (devnet)** | 102 |
| **USDC Mint (mainnet)** | `EPjFWaJY43OwvzxkmmeuL7XMPVeKLSRzSNUM5JKpDjH` |
| **USDC Mint (devnet)** | `4zMMC9srt5Ri5X14LaVQXVcTqRBTZCmV9QWZnaLvWNA` |
| **Decimals** | 6 |
| **Slot Time** | ~400ms |
| **Confirmation Target** | 1 confirmation (~12 seconds) |

#### Solana Provider Setup

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const SolanaConfig = {
  testnet: {
    rpcUrl: clusterApiUrl("devnet"),
    chainId: 102,
    usdcMint: "4zMMC9srt5Ri5X14LaVQXVcTqRBTZCmV9QWZnaLvWNA"
  },
  mainnet: {
    rpcUrl: clusterApiUrl("mainnet-beta"),
    chainId: 101,
    usdcMint: "EPjFWaJY43OwvzxkmmeuL7XMPVeKLSRzSNUM5JKpDjH"
  }
};

const connection = new Connection(SolanaConfig.mainnet.rpcUrl, "confirmed");
```

### Polygon (EVM)

| Property | Value |
|----------|-------|
| **Chain ID** | 137 |
| **USDC Address** | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| **Decimals** | 6 |
| **Block Time** | ~2 seconds |

### XDC Network (EVM)

| Property | Value |
|----------|-------|
| **Chain ID** | 50 |
| **RPC** | `https://rpc.xinfin.network` |
| **Testnet RPC** | `https://rpc.apothem.network` |

---

## Security Considerations

### 1. Replay Attack Prevention

#### Nonce Strategy

```typescript
class NonceTracker {
  private nonces = new Map<string, number>(); // <key, timestamp>
  private readonly TTL_SECONDS = 300; // 5 minutes

  isNonceUsed(chainId: string, nonce: string): boolean {
    const key = `${chainId}:${nonce}`;
    const timestamp = this.nonces.get(key);
    
    if (!timestamp) return false;
    
    // Remove if expired
    if (Date.now() / 1000 - timestamp > this.TTL_SECONDS) {
      this.nonces.delete(key);
      return false;
    }
    
    return true;
  }

  markNonceUsed(chainId: string, nonce: string): void {
    const key = `${chainId}:${nonce}`;
    this.nonces.set(key, Date.now() / 1000);
  }
}
```

#### Timestamp Validation

```typescript
const now = Math.floor(Date.now() / 1000);

// Check validity window
if (payload.validAfter > now) {
  throw new Error("Authorization not yet valid");
}

if (payload.validBefore < now) {
  throw new Error("Authorization expired");
}

// Enforce reasonable time bounds (±30 minutes)
if (now - payload.validAfter > 1800) {
  throw new Error("Authorization issued too long ago");
}
```

### 2. Double-Spend Prevention

#### Strategy: Confirmation Blocks

```typescript
// Wait for N blocks before considering payment final
const CONFIRMATION_BLOCKS = {
  "base-sepolia": 3,      // ~6 seconds
  "base": 3,              // ~6 seconds
  "solana": 1,            // ~12 seconds
  "avalanche": 1          // ~2 seconds
};

async waitForConfirmation(txHash: string, network: string) {
  const blocks = CONFIRMATION_BLOCKS[network];
  return provider.waitForTransaction(txHash, blocks);
}
```

#### Strategy: Idempotency Keys

```typescript
// Track settled payments to prevent resubmission
const settledPayments = new Map<string, SettlementResult>();

function generatePaymentId(payload: any): string {
  return keccak256(
    JSON.stringify({
      from: payload.from,
      to: payload.to,
      amount: payload.value,
      nonce: payload.nonce,
      network: payload.network
    })
  );
}

async settlePayment(payload: any, requirements: any) {
  const paymentId = generatePaymentId(payload);
  
  if (settledPayments.has(paymentId)) {
    return settledPayments.get(paymentId); // Return cached result
  }
  
  // Perform settlement...
  const result = await executeOnChain(...);
  settledPayments.set(paymentId, result);
  
  return result;
}
```

### 3. Signature Verification

#### Critical Checks

```typescript
async verifySignature(payload: any, requirements: any): Promise<boolean> {
  // 1. Chain ID must match requirements
  if (payload.chainId !== this.chainIdMap[requirements.network]) {
    throw new Error("Chain ID mismatch");
  }

  // 2. Verifying contract must match asset
  if (
    payload.domain.verifyingContract.toLowerCase() !==
    requirements.asset.toLowerCase()
  ) {
    throw new Error("Asset mismatch");
  }

  // 3. Recipient must be facilitator (to → facilitator address)
  if (
    payload.payload.to.toLowerCase() !==
    this.facilitatorAddress.toLowerCase()
  ) {
    throw new Error("Recipient is not facilitator");
  }

  // 4. Verify signature cryptographically
  const recovered = recoverAddress(messageHash, signature);
  if (recovered.toLowerCase() !== payload.payload.from.toLowerCase()) {
    throw new Error("Invalid signature");
  }

  return true;
}
```

### 4. Rate Limiting

```typescript
class RateLimiter {
  private requests = new Map<string, number[]>(); // <key, timestamps>

  isAllowed(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps outside window
    const recentRequests = timestamps.filter(
      t => now - t < windowSeconds * 1000
    );

    if (recentRequests.length >= maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }
}

// Usage
const limiter = new RateLimiter();

if (!limiter.isAllowed(payer, 10, 60)) {
  throw new Error("Rate limit exceeded: max 10 payments per minute");
}
```

### 5. Key Management

#### Private Key Security

```typescript
// ❌ NEVER hardcode
const KEY = "0x1234...";

// ✅ Use environment variables
import dotenv from "dotenv";
dotenv.config();
const KEY = process.env.FACILITATOR_PRIVATE_KEY;

// ✅ Or HSM (Hardware Security Module)
import hsm from "@pkcs11/hsm-client";
const signingKey = await hsm.getSigningKey("facilitator-key");
```

### 6. KYT/OFAC Compliance

```typescript
async checkCompliance(payer: string, amount: string): Promise<boolean> {
  // Integration with KYT provider (Circle, Chainalysis, etc.)
  const kytResult = await kytProvider.checkAddress(payer, amount);

  if (kytResult.isFlagged) {
    logger.warn(`Payment from flagged address: ${payer}`);
    return false;
  }

  return true;
}
```

---

## TypeScript Implementation Patterns

### Facilitator Core Class

```typescript
import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";

interface FacilitatorConfig {
  networks: {
    [key: string]: {
      rpcUrl: string;
      chainId: number;
      assetAddress: string;
      assetName: string;
      assetVersion: string;
    };
  };
  signer: {
    privateKey: string;
    type: "evm" | "solana";
  };
  confirmations: number;
}

class X402Facilitator {
  private config: FacilitatorConfig;
  private evmProviders = new Map<string, ethers.Provider>();
  private solanaConnection: Connection;
  private nonces = new Map<string, number>();
  private signerWallet: ethers.Wallet | null = null;

  constructor(config: FacilitatorConfig) {
    this.config = config;
    this.initializeProviders();
    this.initializeSigner();
  }

  private initializeProviders() {
    for (const [network, netConfig] of Object.entries(this.config.networks)) {
      if (netConfig.rpcUrl.includes("solana")) {
        this.solanaConnection = new Connection(netConfig.rpcUrl, "confirmed");
      } else {
        this.evmProviders.set(
          network,
          new ethers.JsonRpcProvider(netConfig.rpcUrl)
        );
      }
    }
  }

  private initializeSigner() {
    if (this.config.signer.type === "evm") {
      this.signerWallet = new ethers.Wallet(this.config.signer.privateKey);
    }
  }

  async verify(
    paymentHeader: string,
    requirements: any
  ): Promise<{ isValid: boolean; invalidReason: string | null }> {
    try {
      const payload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString()
      );

      // Validate nonce
      const nonceKey = `${requirements.network}:${payload.payload.nonce}`;
      if (this.nonces.has(nonceKey)) {
        return { isValid: false, invalidReason: "Nonce already used" };
      }

      // Validate expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.payload.validBefore < now) {
        return { isValid: false, invalidReason: "Authorization expired" };
      }

      // Verify signature
      const isValidSig = await this.verifySignature(payload, requirements);
      if (!isValidSig) {
        return { isValid: false, invalidReason: "Invalid signature" };
      }

      // Mark nonce used
      this.nonces.set(nonceKey, now);

      return { isValid: true, invalidReason: null };
    } catch (error: any) {
      return { isValid: false, invalidReason: error.message };
    }
  }

  async settle(
    paymentHeader: string,
    requirements: any
  ): Promise<{
    success: boolean;
    error: string | null;
    txHash: string | null;
    networkId: string | null;
  }> {
    try {
      const payload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString()
      );

      // Re-verify
      const verifyResult = await this.verify(paymentHeader, requirements);
      if (!verifyResult.isValid) {
        return {
          success: false,
          error: verifyResult.invalidReason,
          txHash: null,
          networkId: requirements.network
        };
      }

      let txHash: string;

      if (requirements.network.includes("solana")) {
        txHash = await this.settleSolana(payload, requirements);
      } else {
        txHash = await this.settleEVM(payload, requirements);
      }

      return {
        success: true,
        error: null,
        txHash,
        networkId: requirements.network
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        txHash: null,
        networkId: requirements.network
      };
    }
  }

  private async verifySignature(payload: any, requirements: any): Promise<boolean> {
    // EIP-712 signature verification logic
    // (implementation shown in previous section)
    return true; // Placeholder
  }

  private async settlEVM(payload: any, requirements: any): Promise<string> {
    // EVM settlement logic
    // (implementation shown in previous section)
    return "0x";
  }

  private async settleSolana(payload: any, requirements: any): Promise<string> {
    // Solana settlement logic
    // (implementation shown in previous section)
    return "";
  }

  async getSupported(): Promise<{ kinds: any[] }> {
    const kinds = [];
    for (const network of Object.keys(this.config.networks)) {
      kinds.push({
        scheme: "exact",
        network
      });
    }
    return { kinds };
  }
}

export default X402Facilitator;
```

### Express Middleware Integration

```typescript
import express, { Request, Response, NextFunction } from "express";
import X402Facilitator from "./facilitator";

class X402Express {
  private facilitator: X402Facilitator;

  constructor(facilitator: X402Facilitator) {
    this.facilitator = facilitator;
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const paymentHeader = req.headers["x-payment"] as string;

      if (!paymentHeader) {
        return res.status(402).json({
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: "base-sepolia",
              maxAmountRequired: "10000",
              resource: req.originalUrl,
              description: "API access",
              mimeType: "application/json",
              payTo: "0xRecipientAddress",
              maxTimeoutSeconds: 60,
              asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              extra: { name: "USDC", version: "2" }
            }
          ],
          error: null
        });
      }

      // Verify payment
      const verifyResult = await this.facilitator.verify(
        paymentHeader,
        {
          network: "base-sepolia",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
        }
      );

      if (!verifyResult.isValid) {
        return res.status(402).json({
          x402Version: 1,
          accepts: [],
          error: verifyResult.invalidReason
        });
      }

      next();
    };
  }
}

export default X402Express;
```

---

## Production Deployment

### Environment Configuration

```bash
# .env
FACILITATOR_PRIVATE_KEY=0x...
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Networks
NETWORKS=base,base-sepolia,solana,solana-devnet

# Base
BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/KEY
BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_RPC=https://base-mainnet.g.alchemy.com/v2/KEY
BASE_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Solana
SOLANA_DEVNET_RPC=https://api.devnet.solana.com
SOLANA_RPC=https://api.mainnet-beta.solana.com
SOLANA_USDC_MINT=EPjFWaJY43OwvzxkmmeuL7XMPVeKLSRzSNUM5JKpDjH

# Compliance
KYT_ENABLED=true
KYT_PROVIDER=circle
KYT_API_KEY=...

# Monitoring
SENTRY_DSN=...
DATADOG_API_KEY=...
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Health Checks

```typescript
import { Router } from "express";

export function healthRouter(facilitator: X402Facilitator) {
  const router = Router();

  router.get("/health", async (req, res) => {
    try {
      const supported = await facilitator.getSupported();
      return res.json({
        status: "healthy",
        supported,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      return res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}
```

### Monitoring & Observability

```typescript
import pino from "pino";
import * as Sentry from "@sentry/node";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true
    }
  }
});

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});

// Log settlement attempts
logger.info(
  {
    event: "settlement_attempt",
    payer: payload.from,
    amount: payload.value,
    network: requirements.network,
    txHash: result.txHash
  },
  "Settlement executed"
);
```

---

## Summary: Quick Reference

| Aspect | Details |
|--------|---------|
| **Verification** | EIP-712 signature check + nonce tracking + expiry validation |
| **Settlement** | Transaction building → signing → broadcast → confirmation polling |
| **Chains** | Base, Avalanche, Polygon, Solana, XDC, and extensible |
| **Tokens** | USDC (EIP-3009 on EVM), SPL tokens on Solana |
| **Security** | Nonce tracking, timestamp validation, signature verification, rate limiting, KYT |
| **Performance** | ~200ms on Base, <1s on Solana, 1-3 block confirmations |
| **Error Handling** | Always return proper x402 error responses (402 status) |

---

**Last Updated**: October 2025
**Protocol Version**: V1 (exact scheme)
**Facilitator API Version**: 1.0