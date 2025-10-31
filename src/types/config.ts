/**
 * Configuration options for Solana (SVM) RPC connections.
 */
export interface SvmConfig {
  /**
   * Custom RPC URL for Solana connections.
   * If not provided, defaults to public Solana RPC endpoints based on network.
   */
  rpcUrl?: string;
}

/**
 * Configuration options for EVM RPC connections.
 */
export interface EvmConfig {
  /**
   * Custom RPC URL for EVM connections.
   * If not provided, defaults to the RPC URL from the chain definition.
   */
  rpcUrl?: string;
}

/**
 * Configuration options for X402 client and facilitator operations.
 */
export interface X402Config {
  /** Configuration for EVM operations */
  evmConfig?: EvmConfig;
  /** Configuration for Solana (SVM) operations */
  svmConfig?: SvmConfig;
}
