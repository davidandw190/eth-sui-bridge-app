import { BridgeDirection } from '../types';
import { useState } from 'react';

export function useBridgeState() {
  const [amount, setAmount] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [direction, setDirection] = useState<BridgeDirection>('eth-to-sui');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  return {
    amount,
    setAmount,
    tokenBalance,
    setTokenBalance,
    direction,
    setDirection,
    isProcessing,
    setIsProcessing
  };
}