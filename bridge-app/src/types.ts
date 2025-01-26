import { Contract, ContractTransactionResponse } from 'ethers';

export interface IBTTokenInterface {
  balanceOf(account: string): Promise<bigint>;
  approve(
    spender: string,
    amount: bigint
  ): Promise<ContractTransactionResponse>;
  transfer(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  totalSupply(): Promise<bigint>;

  mint(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  burn(from: string, amount: bigint): Promise<ContractTransactionResponse>;
  lockTokens(
    amount: bigint,
    suiAddress: string
  ): Promise<ContractTransactionResponse>;
  unlockTokens(
    to: string,
    amount: bigint
  ): Promise<ContractTransactionResponse>;

  owner(): Promise<string>;
  pause(): Promise<ContractTransactionResponse>;
  unpause(): Promise<ContractTransactionResponse>;
}

export type IBTContract = Contract & IBTTokenInterface;

export interface BridgeConfig {
  ethereumContract: string;
  suiPackageId: string;
  suiAdminCapId: string;
  suiTreasuryCapId: string;
  suiNetwork: string;
}

export type BridgeDirection = 'eth-to-sui' | 'sui-to-eth';
