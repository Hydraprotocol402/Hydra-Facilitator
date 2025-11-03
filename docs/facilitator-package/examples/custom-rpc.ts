/**
 * Custom RPC Configuration Example
 *
 * This example demonstrates using custom RPC URLs for EVM and SVM networks.
 */

import { verify, settle } from "x402-hydra-facilitator";
import { createConnectedClient, createSigner } from "x402-hydra-facilitator/shared";
import type { PaymentPayload, PaymentRequirements, X402Config } from "x402-hydra-facilitator/types";

/**
 * Example: Custom EVM RPC
 */
async function verifyWithCustomEvmRpc(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
) {
  // Custom RPC configuration
  const config: X402Config = {
    evmConfig: {
      rpcUrl: process.env.EVM_RPC_URL || "https://custom-evm-rpc.example.com",
    },
  };

  // Create client with custom RPC
  const client = createConnectedClient(requirements.network, config);

  // Verify payment
  const result = await verify(client, payload, requirements, config);

  return result;
}

/**
 * Example: Custom SVM RPC
 */
async function settleWithCustomSvmRpc(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  privateKey: string,
) {
  // Custom RPC configuration
  const config: X402Config = {
    svmConfig: {
      rpcUrl: process.env.SOLANA_RPC_URL || "https://custom-solana-rpc.example.com",
    },
  };

  // Create signer with custom RPC
  const signer = await createSigner(requirements.network, privateKey, config);

  // Settle payment
  const result = await settle(signer, payload, requirements, config);

  return result;
}

/**
 * Example: Environment-based configuration
 */
function getConfig(): X402Config {
  const config: X402Config = {};

  // EVM RPC from environment
  if (process.env.EVM_RPC_URL) {
    config.evmConfig = {
      rpcUrl: process.env.EVM_RPC_URL,
    };
  }

  // SVM RPC from environment
  if (process.env.SOLANA_RPC_URL) {
    config.svmConfig = {
      rpcUrl: process.env.SOLANA_RPC_URL,
    };
  }

  return config;
}

/**
 * Example: Using configuration for both verification and settlement
 */
async function processPaymentWithCustomRpc(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  privateKey: string,
) {
  // Get configuration
  const config = getConfig();

  // Verify with custom RPC
  const client = createConnectedClient(requirements.network, config);
  const verifyResult = await verify(client, payload, requirements, config);

  if (!verifyResult.isValid) {
    return { success: false, error: verifyResult.invalidReason };
  }

  // Settle with custom RPC
  const signer = await createSigner(requirements.network, privateKey, config);
  const settleResult = await settle(signer, payload, requirements, config);

  if (!settleResult.success) {
    return { success: false, error: settleResult.errorReason };
  }

  return {
    success: true,
    transaction: settleResult.transaction,
  };
}

export {
  verifyWithCustomEvmRpc,
  settleWithCustomSvmRpc,
  getConfig,
  processPaymentWithCustomRpc,
};

