import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { useEffect, useState } from 'react';

import { useCurrentWallet } from '@mysten/dapp-kit';

export function useSuiWallet() {
  const [suiBalance, setSuiBalance] = useState<string>('0');
  const { currentWallet, isConnected } = useCurrentWallet();

  const checkSuiBalance = async () => {
    if (!currentWallet?.accounts[0]) return;

    try {
      const suiClient = new SuiClient({
        url: getFullnodeUrl('devnet'),
      });

      const coins = await suiClient.getCoins({
        owner: currentWallet.accounts[0].address,
        coinType: '0x2::sui::SUI',
      });

      const balance =
        coins.data?.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) || 0n;
      setSuiBalance(balance.toString());
    } catch (error) {
      console.error('Error checking Sui balance:', error);
    }
  };

    useEffect(() => {
      const checkInitialSuiBalance = async () => {
        if (currentWallet?.accounts[0]) {
          try {
            const suiClient = new SuiClient({
              url: getFullnodeUrl('devnet'),
            });
  
            const coins = await suiClient.getCoins({
              owner: currentWallet.accounts[0].address,
              coinType: '0x2::sui::SUI',
            });
  
            const balance =
              coins.data?.reduce((acc, coin) => acc + BigInt(coin.balance), 0n) ||
              0n;
            setSuiBalance(balance.toString());
          } catch (error) {
            console.error('Error checking initial Sui balance:', error);
          }
        }
      };
  
      checkInitialSuiBalance();
    }, [currentWallet?.accounts[0]]); 
  

  return {
    suiBalance,
    currentWallet,
    isConnected,
    checkSuiBalance
  };
}