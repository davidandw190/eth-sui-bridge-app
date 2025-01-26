import { CONFIG, ETH_CONTRACT_ABI } from '../config';
import { useEffect, useState } from 'react';

import { IBTContract } from '../types';
import { ethers } from 'ethers';

const LOCAL_CHAIN_ID = '0x7A69';

export function useEthereumWallet() {
  const [ethProvider, setEthProvider] = useState<ethers.BrowserProvider | null>(null);
  const [ethContract, setEthContract] = useState<IBTContract | null>(null);
  const [ethSigner, setEthSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isConnectingWallet, setIsConnectingWallet] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const verifyContractDeployment = async () => {
      if (!ethProvider) return false;
  
      try {
        const code = await ethProvider.getCode(CONFIG.ethereumContract);
  
        if (code === '0x') {
          console.error('No contract found at specified address');
          return false;
        }
  
        console.log('Contract code found at address');
        return true;
      } catch (error) {
        console.error('Error verifying contract deployment:', error);
        return false;
      }
    };

  const connectEthereumWallet = async () => {
      // to prevent multiple connection attempts
      if (isConnectingWallet) return;
  
      setIsConnectingWallet(true);
      setError(null);
  
      try {
        // check for metaMask installation
        if (typeof window.ethereum === 'undefined') {
          throw new Error(
            'MetaMask is not installed. Please install MetaMask to use this application.'
          );
        }
  
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== LOCAL_CHAIN_ID) {
          try {
            // switch to the local network
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: LOCAL_CHAIN_ID }],
            });
          } catch (switchError: any) {
            // if the network doesn't exist in MetaMask, add it
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: LOCAL_CHAIN_ID,
                      chainName: 'Anvil Local Testnet',
                      rpcUrls: ['http://localhost:8545'],
                      nativeCurrency: {
                        name: 'ETH',
                        symbol: 'ETH',
                        decimals: 18,
                      },
                    },
                  ],
                });
              } catch (addError) {
                throw new Error('Could not add Anvil network to MetaMask');
              }
            } else {
              throw new Error('Please switch to Anvil testnet in MetaMask');
            }
          }
        }
  
        try {
          const accounts = (await window.ethereum.request({
            method: 'eth_requestAccounts',
          })) as string[];
  
          if (!accounts || accounts.length === 0) {
            throw new Error(
              'No accounts found. Please ensure MetaMask is unlocked.'
            );
          }
  
          setWalletAddress(accounts[0]);
  
          // init ethers provider with the connected account
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
  
          // create contract instance with the connected signer
          const contract = new ethers.Contract(
            CONFIG.ethereumContract,
            ETH_CONTRACT_ABI,
            provider
          ) as IBTContract;
  
          setEthProvider(provider);
          setEthSigner(signer);
          setEthContract(contract);
  
          const isDeployed = await verifyContractDeployment();
  
          if (!isDeployed) {
            throw new Error(
              'Contract not deployed. Please deploy the contract first.'
            );
          }
  
          const contractOwner = await contract.owner();
          const currentAddress = await signer.getAddress();
  
          if (contractOwner.toLowerCase() !== currentAddress.toLowerCase()) {
            console.warn('Connected account is not the contract owner');
          }
  
          console.log('Successfully connected to MetaMask');
        } catch (error: any) {
          if (error.code === -32002) {
            throw new Error(
              'A connection request is already pending. Please check MetaMask.'
            );
          } else if (error.code === 4001) {
            throw new Error(
              'Connection rejected. Please approve the connection in MetaMask.'
            );
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error('Wallet connection error:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to connect to MetaMask'
        );
      } finally {
        setIsConnectingWallet(false);
      }
    };
  
    useEffect(() => {
      if (typeof window.ethereum !== 'undefined' && !ethProvider) {
        // init base provider
        const provider = new ethers.BrowserProvider(window.ethereum);
        setEthProvider(provider);
  
        // handler for account changes
        const handleAccountsChanged = (accounts: string[]) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
          } else {
            // reset state when all accounts are disconnected
            setWalletAddress('');
            setEthSigner(null);
            setEthContract(null);
          }
        };
  
        // handler for chain changes
        const handleChainChanged = () => {
          window.location.reload();
        };
  
        // set up event listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
  
        // cleanup function to remove listeners
        return () => {
          window.ethereum.removeListener(
            'accountsChanged',
            handleAccountsChanged
          );
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
      }
    }, [ethProvider]);

  return {
    ethProvider,
    ethContract,
    ethSigner,
    walletAddress,
    isConnectingWallet,
    error,
    connectEthereumWallet,
    setError
  };
}