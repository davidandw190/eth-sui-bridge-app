import { IBTContract } from '../types';
import { ethers } from 'ethers';

const createEthLog = (operation: string, details: any) => {
  console.log(`[Ethereum Service][${operation}]`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export class EthereumService {
  static async verifyContract(
    ethContract: IBTContract,
    ethSigner: ethers.JsonRpcSigner
  ): Promise<boolean> {
    try {
      createEthLog('Contract Verification - Start', {
        contractAddress: ethContract.target,
      });

      const contractOwner = await ethContract.owner();
      const signerAddress = await ethSigner.getAddress();
      const balance = await ethContract.balanceOf(signerAddress);

      createEthLog('Contract Verification - Complete', {
        contractOwner,
        signerAddress,
        currentBalance: ethers.formatEther(balance),
        status: 'success',
      });

      return true;
    } catch (error) {
      createEthLog('Contract Verification - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      return false;
    }
  }

  static async checkBalance(
    contract: IBTContract,
    address: string
  ): Promise<string> {
    try {
      createEthLog('Balance Check - Start', { address });

      const balance = await contract.balanceOf(address);
      const formattedBalance = ethers.formatEther(balance);

      createEthLog('Balance Check - Complete', {
        address,
        balance: formattedBalance,
        status: 'success',
      });

      return formattedBalance;
    } catch (error) {
      createEthLog('Balance Check - Failed', {
        address,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async mintTokens(
    contract: IBTContract,
    signer: ethers.JsonRpcSigner,
    amount: string
  ): Promise<void> {
    try {
      const signerAddress = await signer.getAddress();
      const mintAmount = ethers.parseEther(amount);

      createEthLog('Token Mint - Initialize', {
        address: signerAddress,
        amount,
        amountWei: mintAmount.toString(),
      });

      const contractWithSigner = contract.connect(signer) as IBTContract;
      const tx = await contractWithSigner.mint(signerAddress, mintAmount);

      createEthLog('Token Mint - Transaction Submitted', {
        transactionHash: tx.hash,
        status: 'pending',
      });

      const receipt = await tx.wait();

      if (!receipt) {
        return;
      }

      createEthLog('Token Mint - Complete', {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: 'success',
      });
    } catch (error) {
      createEthLog('Token Mint - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async burnTokens(
    contract: IBTContract,
    signer: ethers.JsonRpcSigner,
    amount: string
  ) {
    try {
      const signerAddress = await signer.getAddress();
      const burnAmount = ethers.parseEther(amount);

      createEthLog('Token Burn - Initialize', {
        address: signerAddress,
        amount,
        amountWei: burnAmount.toString(),
      });

      const contractWithSigner = contract.connect(signer) as IBTContract;
      const tx = await contractWithSigner.burn(signerAddress, burnAmount);

      createEthLog('Token Burn - Transaction Submitted', {
        transactionHash: tx.hash,
        status: 'pending',
      });

      const receipt = await tx.wait();

      if (!receipt) {
        return;
      }

      createEthLog('Token Burn - Complete', {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: 'success',
      });

      return receipt;
    } catch (error) {
      createEthLog('Token Burn - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async handleEthToSuiBridge(
    contract: IBTContract,
    signer: ethers.JsonRpcSigner,
    amount: string
  ) {
    try {
      createEthLog('ETH->SUI Bridge - Start', {
        amount,
        signerAddress: await signer.getAddress(),
      });

      const amountWei = ethers.parseEther(amount);
      const signerAddress = await signer.getAddress();
      const balanceWei = await contract.balanceOf(signerAddress);

      createEthLog('ETH->SUI Bridge - Balance Check', {
        requestedAmount: amountWei.toString(),
        currentBalance: balanceWei.toString(),
        hasEnoughBalance: balanceWei >= amountWei,
      });

      if (balanceWei < amountWei) {
        createEthLog('ETH->SUI Bridge - Insufficient Balance', {
          action: 'initiating mint',
        });

        await this.mintTokens(contract, signer, amount);
        const newBalance = await contract.balanceOf(signerAddress);

        createEthLog('ETH->SUI Bridge - Balance After Mint', {
          newBalance: newBalance.toString(),
        });

        if (newBalance < amountWei) {
          throw new Error('Insufficient balance even after minting');
        }
      }

      const receipt = await this.burnTokens(contract, signer, amount);

      if (!receipt) {
        return;
      }

      createEthLog('ETH->SUI Bridge - Complete', {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: 'success',
      });

      return receipt;
    } catch (error) {
      createEthLog('ETH->SUI Bridge - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }

  static async handleSuiToEthBridge(
    contract: IBTContract,
    signer: ethers.JsonRpcSigner,
    amount: string
  ) {
    try {
      createEthLog('SUI->ETH Bridge - Start', {
        amount,
        signerAddress: await signer.getAddress(),
      });

      const amountWei = ethers.parseEther(amount);
      const signerAddress = await signer.getAddress();

      const tx = await contract.connect(signer).mint(signerAddress, amountWei);

      createEthLog('SUI->ETH Bridge - Transaction Submitted', {
        transactionHash: tx.hash,
        status: 'pending',
      });

      const receipt = await tx.wait();

      createEthLog('SUI->ETH Bridge - Complete', {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: 'success',
      });

      return receipt;
    } catch (error) {
      createEthLog('SUI->ETH Bridge - Failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed',
      });
      throw error;
    }
  }
}
