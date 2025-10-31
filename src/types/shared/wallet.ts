import * as evm from "./evm/wallet";
import * as svm from "../../shared/svm/wallet";
import { SupportedEVMNetworks, SupportedSVMNetworks } from "./network";
import { Hex } from "viem";
import { X402Config } from "../config";

export type ConnectedClient = evm.ConnectedClient | svm.SvmConnectedClient;
export type Signer = evm.EvmSigner | svm.SvmSigner;
export type MultiNetworkSigner = { evm: evm.EvmSigner; svm: svm.SvmSigner };

/**
 * Creates a public client configured for the specified network.
 *
 * @param network - The network to connect to.
 * @param config - Optional X402 configuration containing custom RPC URLs.
 * @returns A public client instance connected to the specified chain.
 */
export function createConnectedClient(network: string, config?: X402Config): ConnectedClient {
  if (SupportedEVMNetworks.find(n => n === network)) {
    const rpcUrl = config?.evmConfig?.rpcUrl;
    return evm.createConnectedClient(network, rpcUrl);
  }

  if (SupportedSVMNetworks.find(n => n === network)) {
    return svm.createSvmConnectedClient(network);
  }

  throw new Error(`Unsupported network: ${network}`);
}

/**
 * Creates a wallet client configured for the specified chain with a private key.
 *
 * @param network - The network to connect to.
 * @param privateKey - The private key to use for signing transactions. This should be a hex string for EVM or a base58 encoded string for SVM.
 * @param config - Optional X402 configuration containing custom RPC URLs.
 * @returns A wallet client instance connected to the specified chain with the provided private key.
 */
export function createSigner(
  network: string,
  privateKey: Hex | string,
  config?: X402Config,
): Promise<Signer> {
  if (SupportedEVMNetworks.find(n => n === network)) {
    const rpcUrl = config?.evmConfig?.rpcUrl;
    return Promise.resolve(evm.createSigner(network, privateKey as Hex, rpcUrl));
  }

  if (SupportedSVMNetworks.find(n => n === network)) {
    return svm.createSignerFromBase58(privateKey as string);
  }

  throw new Error(`Unsupported network: ${network}`);
}

/**
 * Checks if the given wallet is an EVM signer wallet.
 *
 * @param wallet - The object wallet to check.
 * @returns True if the wallet is an EVM signer wallet, false otherwise.
 */
export function isEvmSignerWallet(wallet: Signer): wallet is evm.EvmSigner {
  return evm.isSignerWallet(wallet as evm.EvmSigner) || evm.isAccount(wallet as evm.EvmSigner);
}

/**
 * Checks if the given wallet is an SVM signer wallet
 *
 * @param wallet - The object wallet to check
 * @returns True if the wallet is an SVM signer wallet, false otherwise
 */
export function isSvmSignerWallet(wallet: Signer): wallet is svm.SvmSigner {
  return svm.isSignerWallet(wallet);
}

/**
 * Checks if the given wallet is a multi network signer wallet
 *
 * @param wallet - The object wallet to check
 * @returns True if the wallet is a multi network signer wallet, false otherwise
 */
export function isMultiNetworkSigner(wallet: object): wallet is MultiNetworkSigner {
  return "evm" in wallet && "svm" in wallet;
}
