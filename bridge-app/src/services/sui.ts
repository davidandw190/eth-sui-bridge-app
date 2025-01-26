import { CONFIG, SuiChain } from '../config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

import { TransactionBlock } from '@mysten/sui.js/transactions';
import { WalletAccount } from '@mysten/wallet-standard';
import { ethers } from 'ethers';

const createSuiLog = (operation: string, details: any) => {
  console.log(`[Sui Service][${operation}]`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export class SuiService {
  private static client: SuiClient = new SuiClient({
    url: getFullnodeUrl('devnet'),
  });

  static async verifySetup(): Promise<boolean> {
    try {
      createSuiLog('Setup Verification - Start', {
        packageId: CONFIG.suiPackageId,
        adminCapId: CONFIG.suiAdminCapId,
      });

      const packageObj = await this.client.getObject({
        id: CONFIG.suiPackageId,
        options: { showContent: true, showType: true },
      });

      createSuiLog('Package Verification', {
        status: packageObj.data ? 'found' : 'not found',
        packageId: CONFIG.suiPackageId,
      });

      if (!packageObj.data) {
        throw new Error(`Package ${CONFIG.suiPackageId} not found`);
      }

      const adminObj = await this.client.getObject({
        id: CONFIG.suiAdminCapId,
        options: { showContent: true, showType: true },
      });

      createSuiLog('Admin Capability Verification', {
        status: adminObj.data ? 'found' : 'not found',
        adminCapId: CONFIG.suiAdminCapId,
      });

      if (!adminObj.data) {
        throw new Error('Admin capability not found');
      }

      createSuiLog('Setup Verification - Complete', {
        status: 'success',
      });

      return true;
    } catch (error) {
      createSuiLog('Setup Verification - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      return false;
    }
  }

  static async prepareTransactionInput(
    tx: TransactionBlock,
    chain: SuiChain,
    account: WalletAccount
  ) {
    try {
      createSuiLog('Transaction Preparation - Start', {
        sender: account.address,
        chain,
      });

      tx.setGasBudget(50000000);
      tx.setSender(account.address);

      createSuiLog('Transaction Build - Start', {
        gasBudget: 50000000,
        sender: account.address,
      });

      const builtTx = await tx.build({
        client: this.client,
        onlyTransactionKind: false,
      });

      if (!builtTx || builtTx.length === 0) {
        throw new Error('Failed to build transaction: Empty transaction data');
      }

      createSuiLog('Transaction Build - Complete', {
        transactionSize: builtTx.length,
        status: 'success',
      });

      const transactionBytes = this.createTransactionBytes(builtTx);

      createSuiLog('Transaction Preparation - Complete', {
        status: 'success',
      });

      return {
        transaction: transactionBytes,
        chain,
        account,
        requestType: 'WaitForLocalExecution' as const,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      };
    } catch (error) {
      createSuiLog('Transaction Preparation - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async mintTestTokens(
    wallet: WalletAccount,
    signAndExecute: any
  ): Promise<void> {
    try {
      createSuiLog('Test Token Mint - Initialize', {
        walletAddress: wallet.address,
      });

      const tx = new TransactionBlock();
      const dummyTxHash = new Uint8Array(32).fill(0);
      const mintAmount = ethers.parseEther('1000').toString();

      createSuiLog('Test Token Mint - Parameters', {
        mintAmount,
        dummyTxHashLength: dummyTxHash.length,
      });

      tx.moveCall({
        target: `${CONFIG.suiPackageId}::ibt_token::mint_bridged_tokens`,
        arguments: [
          tx.object(CONFIG.suiAdminCapId),
          tx.pure(mintAmount),
          tx.pure(wallet.address),
          tx.pure(Array.from(dummyTxHash)),
        ],
      });

      const input = await this.prepareTransactionInput(
        tx,
        CONFIG.suiNetwork,
        wallet
      );

      createSuiLog('Test Token Mint - Executing', {
        status: 'pending',
      });

      const result = await signAndExecute(input);

      createSuiLog('Test Token Mint - Complete', {
        status: 'success',
        digest: result.digest,
      });
    } catch (error) {
      createSuiLog('Test Token Mint - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async checkIBTBalance(address: string): Promise<string> {
    try {
      const coins = await this.client.getCoins({
        owner: address,
        coinType: `${CONFIG.suiPackageId}::ibt_token::IBT_TOKEN`,
      });

      const balance =
        coins.data?.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) || 0n;

      return ethers.formatEther(balance.toString());
    } catch (error) {
      console.error('Error checking Sui IBT balance:', error);
      return '0';
    }
  }

  // we convert the Uint8Array to a proper base64 string
  private static createTransactionBytes(builtTx: Uint8Array) {
    return {
      kind: 'bytes' as const,
      data: builtTx,
      toJSON: async () => {
        try {
          const bytes = new Uint8Array(builtTx);
          let binaryString = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binaryString += String.fromCharCode(bytes[i]);
          }

          const base64 = btoa(binaryString);
          const padding = base64.length % 4;
          if (padding) {
            return base64 + '='.repeat(4 - padding);
          }

          return base64;
        } catch (error) {
          console.error('Error in base64 encoding:', error);
          throw new Error('Failed to encode transaction data.');
        }
      },
    };
  }

  static async handleEthToSuiBridge(
    ethTxHash: string,
    amount: string,
    recipientAddress: string,
    wallet: WalletAccount,
    signAndExecute: any
  ) {
    try {
      createSuiLog('ETH->SUI Bridge - Initialize', {
        ethTxHash,
        amount,
        recipientAddress,
      });

      const tx = new TransactionBlock();
      const normalizedHash = ethTxHash.startsWith('0x')
        ? ethTxHash
        : '0x' + ethTxHash;
      const txHashBytes = ethers.getBytes(normalizedHash);

      createSuiLog('Bridge Transaction Setup', {
        normalizedHash,
        bytesLength: txHashBytes.length,
        recipientAddress,
        amount,
      });

      tx.moveCall({
        target: `${CONFIG.suiPackageId}::ibt_token::mint_bridged_tokens`,
        arguments: [
          tx.object(CONFIG.suiAdminCapId),
          tx.pure(amount),
          tx.pure(recipientAddress),
          tx.pure(Array.from(txHashBytes)),
        ],
      });

      createSuiLog('Bridge Transaction - Preparing', {
        status: 'preparing input',
      });

      const transactionInput = await this.prepareTransactionInput(
        tx,
        CONFIG.suiNetwork,
        wallet
      );

      createSuiLog('Bridge Transaction - Executing', {
        status: 'pending',
      });

      const result = await signAndExecute(transactionInput);

      createSuiLog('ETH->SUI Bridge - Complete', {
        status: 'success',
        digest: result.digest,
        effects: result.effects?.status,
      });

      return result;
    } catch (error) {
      createSuiLog('ETH->SUI Bridge - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async handleSuiToEthBridge(
    amount: string,
    walletAddress: string,
    ethAddress: string,
    wallet: WalletAccount,
    signAndExecute: any
  ) {
    try {
      createSuiLog('SUI->ETH Bridge - Initialize', {
        amount,
        walletAddress,
        ethAddress: ethAddress.slice(0, 10) + '...',
      });

      // step 1: find suitable coin for bridging
      createSuiLog('SUI->ETH Bridge - Coin Selection', {
        status: 'searching',
        requiredAmount: amount,
      });

      const coinObjectId = await this.selectSuiCoinForBurn(
        walletAddress,
        amount,
        CONFIG.suiPackageId
      );

      createSuiLog('SUI->ETH Bridge - Coin Selected', {
        coinObjectId,
        status: 'success',
      });

      // step 2: burn operation
      createSuiLog('SUI->ETH Bridge - Transaction Creation', {
        status: 'preparing',
      });

      const tx = new TransactionBlock();
      const ethAddressBytes = ethers.getBytes(ethAddress);

      // config the burn operation
      tx.moveCall({
        target: `${CONFIG.suiPackageId}::ibt_token::burn_for_bridge`,
        arguments: [
          tx.object(CONFIG.suiAdminCapId),
          tx.object(coinObjectId),
          tx.pure(ethAddressBytes),
        ],
      });

      createSuiLog('SUI->ETH Bridge - Transaction Built', {
        adminCapId: CONFIG.suiAdminCapId,
        targetFunction: 'burn_for_bridge',
        status: 'prepared',
      });

      // step 3: prepare tx for execution
      createSuiLog('SUI->ETH Bridge - Transaction Preparation', {
        status: 'preparing input',
      });

      const input = await this.prepareTransactionInput(
        tx,
        CONFIG.suiNetwork,
        wallet
      );

      // step 4: exec bridge tx
      createSuiLog('SUI->ETH Bridge - Execution', {
        status: 'executing',
      });

      const result = await signAndExecute(input);

      createSuiLog('SUI->ETH Bridge - Complete', {
        status: 'success',
        digest: result.digest,
        effects: result.effects?.status,
      });

      return result;
    } catch (error) {
      createSuiLog('SUI->ETH Bridge - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async selectSuiCoinForBurn(
    address: string,
    amount: string,
    packageId: string
  ): Promise<string> {
    try {
      createSuiLog('Coin Selection - Start', {
        address,
        requiredAmount: amount,
        packageId,
      });

      createSuiLog('Coin Selection - Querying Coins', {
        coinType: `${packageId}::ibt_token::IBT_TOKEN`,
        status: 'querying',
      });
      // to query all IBT tokens owned by the user
      const coins = await this.client.getCoins({
        owner: address,
        coinType: `${packageId}::ibt_token::IBT_TOKEN`,
      });

      if (!coins.data || coins.data.length === 0) {
        createSuiLog('Coin Selection - No Coins Found', {
          status: 'failed',
          reason: 'no tokens available',
        });
        throw new Error('No IBT tokens found in wallet');
      }

      createSuiLog('Coin Selection - Coins Found', {
        totalCoins: coins.data.length,
        status: 'analyzing',
      });

      const requiredAmount = BigInt(ethers.parseEther(amount).toString());

      createSuiLog('Coin Selection - Balance Analysis', {
        requiredAmount: requiredAmount.toString(),
        availableCoins: coins.data.map((coin) => ({
          id: coin.coinObjectId,
          balance: coin.balance,
        })),
      });

      const suitableCoin = coins.data.find(
        (coin) => BigInt(coin.balance) >= requiredAmount
      );

      if (!suitableCoin) {
        createSuiLog('Coin Selection - No Suitable Coin', {
          status: 'failed',
          requiredAmount: amount,
          reason: 'insufficient balance',
        });
        throw new Error(
          `No single coin found with sufficient balance of ${amount} IBT tokens. You may need to merge your coins.`
        );
      }

      createSuiLog('Coin Selection - Complete', {
        status: 'success',
        selectedCoin: suitableCoin.coinObjectId,
        coinBalance: suitableCoin.balance,
      });

      return suitableCoin.coinObjectId;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to select coin for burning';

      createSuiLog('Coin Selection - Error', {
        error: errorMessage,
        status: 'failed',
      });

      throw new Error(`Coin selection error: ${errorMessage}`);
    }
  }
}
