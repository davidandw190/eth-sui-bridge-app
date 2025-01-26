import './App.css';

import { BridgeDirection, IBTContract } from './types';
import { useEffect, useState } from 'react';

import { ConnectButton } from '@mysten/dapp-kit';
import { EthereumService } from './services/ethereum';
import { SuiService } from './services/sui';
import { ethers } from 'ethers';
import { useEthereumWallet } from './hooks/useEthereumWallet';
import { useSuiWallet } from './hooks/useSuiWallet';

function App() {
  const [amount, setAmount] = useState<string>('');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [direction, setDirection] = useState<'eth-to-sui' | 'sui-to-eth'>(
    'eth-to-sui'
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const { suiBalance, currentWallet, isConnected, checkSuiBalance } =
    useSuiWallet();

  const {
    ethProvider,
    ethContract,
    ethSigner,
    walletAddress,
    isConnectingWallet,
    error,
    connectEthereumWallet,
    setError,
  } = useEthereumWallet();

  const updateBalance = async () => {
    if (!ethContract || !ethSigner) return;
    try {
      const balance = await checkBalance(
        ethContract,
        await ethSigner.getAddress()
      );
      setTokenBalance(balance);
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  useEffect(() => {
    if (ethContract && ethSigner) {
      updateBalance();
    }
  }, [ethContract, ethSigner]);

  const checkBalance = async (ethContract: IBTContract, p0: string) => {
    if (!ethContract || !ethSigner) return '0';

    try {
      const balance = await ethContract.balanceOf(await ethSigner.getAddress());
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error checking balance:', error);
      return '0';
    }
  };

  const requestSuiDevnetTokens = async () => {
    if (!currentWallet?.accounts[0]) {
      setError('Please connect your Sui wallet first');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch('https://faucet.devnet.sui.io/gas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          FixedAmountRequest: {
            recipient: currentWallet.accounts[0].address,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request tokens from faucet');
      }

      setError('Successfully requested tokens! They should arrive shortly.');
      setTimeout(checkSuiBalance, 3000);
    } catch (error) {
      console.error('Error requesting tokens:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to request tokens'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const mintEthTestTokens = async () => {
    if (!ethContract || !ethSigner) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsProcessing(true);
      await EthereumService.mintTokens(ethContract, ethSigner, '1000');
      await updateBalance();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to mint tokens'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const mintSuiTestTokens = async () => {
    if (!currentWallet?.accounts[0]) {
      setError('Sui wallet not connected');
      return;
    }

    try {
      setIsProcessing(true);
      const signTransactionFeature =
        currentWallet?.features['sui:signAndExecuteTransaction'];

      if (!signTransactionFeature) {
        throw new Error('Wallet missing required features');
      }

      await SuiService.mintTestTokens(
        currentWallet.accounts[0],
        signTransactionFeature.signAndExecuteTransaction
      );

      setError('Successfully minted test tokens!');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to mint tokens'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBridge = async () => {
    if (!amount || !ethContract || !ethProvider || !ethSigner) {
      setError('Missing required connections');
      return;
    }

    const signTransactionFeature =
      currentWallet?.features['sui:signAndExecuteTransaction'];
    if (!signTransactionFeature) {
      setError('Sui wallet not properly connected');
      return;
    }

    const suiAccount = currentWallet.accounts[0];
    if (!suiAccount) {
      setError('No Sui account available');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [ethVerified, suiVerified] = await Promise.all([
        EthereumService.verifyContract(ethContract, ethSigner),
        SuiService.verifySetup(),
      ]);

      if (!ethVerified || !suiVerified) {
        throw new Error(
          'Contract verification failed. Please check your configuration.'
        );
      }

      if (direction === 'eth-to-sui') {
        console.log('Starting Ethereum to Sui bridge...');

        // step 1: eth side operations
        const receipt = await EthereumService.handleEthToSuiBridge(
          ethContract,
          ethSigner,
          amount
        );

        if (!receipt) {
          return;
        }

        // step 2: sui side operations
        await SuiService.handleEthToSuiBridge(
          receipt.hash,
          ethers.parseEther(amount).toString(),
          suiAccount.address,
          suiAccount,
          signTransactionFeature.signAndExecuteTransaction
        );
      } else {
        // sui -> ethereum
        console.log('Starting Sui to Ethereum bridge...');

        // step 1: sui side operations
        const suiResult = await SuiService.handleSuiToEthBridge(
          amount,
          suiAccount.address,
          await ethSigner.getAddress(),
          suiAccount,
          signTransactionFeature.signAndExecuteTransaction
        );

        // step 2: eth side operations
        if (suiResult) {
          await EthereumService.handleSuiToEthBridge(
            ethContract,
            ethSigner,
            amount
          );
        }
      }

      setAmount('');
      setError(null);
      console.log('Bridge operation completed successfully');
    } catch (error) {
      console.error('Bridge error:', error);

      if (error instanceof Error) {
        if (error.message.includes('Missing transaction sender')) {
          setError(
            'Failed to prepare Sui transaction. Please ensure your Sui wallet is properly connected.'
          );
        } else if (error.message.includes('execution reverted')) {
          setError(
            'Transaction failed. Please check your token balance and approvals.'
          );
        } else {
          setError(`Bridge error: ${error.message}`);
        }
      } else {
        setError('Failed to complete bridge transaction');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header className="bridge-header">
        <h1>IBT Chain Bridge</h1>
        <p className="subtitle">
          Demo app built for my Introduction to Blockchain course
        </p>
      </header>

      <main className="bridge-content">
        <section className="wallet-section">
          <div className="wallet-grid">
            <div className="wallet-card ethereum">
              <div className="wallet-header">
                <h2>Ethereum Wallet</h2>
                <div className="network-badge">Anvil Testnet</div>
              </div>

              <div className="wallet-content">
                <button
                  onClick={connectEthereumWallet}
                  disabled={isConnectingWallet}
                  className={`wallet-button ${
                    walletAddress ? 'connected' : ''
                  }`}
                >
                  {isConnectingWallet ? (
                    <span className="loading-text">
                      <span className="loading-indicator"></span>
                      Connecting...
                    </span>
                  ) : walletAddress ? (
                    <>
                      <span className="wallet-icon connected"></span>
                      {`${walletAddress.slice(0, 6)}...${walletAddress.slice(
                        -4
                      )}`}
                    </>
                  ) : (
                    <>
                      <span className="wallet-icon"></span>
                      Connect MetaMask
                    </>
                  )}
                </button>

                {ethSigner && (
                  <div className="wallet-details">
                    <div className="balance-display">
                      <span className="balance-label">Balance:</span>
                      <span className="balance-amount">{tokenBalance} IBT</span>
                    </div>
                    <button
                      onClick={mintEthTestTokens}
                      className="action-button mint-button"
                      disabled={isProcessing}
                    >
                      Mint ETH Test Tokens
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="wallet-card sui">
              <div className="wallet-header">
                <h2>Sui Wallet</h2>
                <div className="network-badge">Devnet</div>
              </div>

              <div className="wallet-content">
                <div className="sui-wallet-connection ">
                  <ConnectButton
                    connectText="Connect Sui Wallet"
                    className={`sui-connect-button ${
                      walletAddress ? 'connected' : 'not-connected'
                    }`}
                  />
                </div>

                {currentWallet?.accounts[0] && (
                  <div className="wallet-details">
                    <div className="balance-grid">
                      <div className="balance-display">
                        <span className="balance-label">SUI Balance:</span>
                        <span className="balance-amount">{suiBalance} SUI</span>
                      </div>
                    </div>

                    <div className="action-buttons">
                      <button
                        onClick={requestSuiDevnetTokens}
                        className="action-button faucet-button"
                        disabled={isProcessing}
                      >
                        Request SUI Tokens
                      </button>
                      <button
                        onClick={mintSuiTestTokens}
                        className="action-button mint-button"
                        disabled={isProcessing}
                      >
                        Mint IBT Tokens
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="bridge-section">
          <div className="bridge-card">
            <div className="bridge-header">
              <h2>Bridge Tokens</h2>
              <div className="bridge-status">
                {isProcessing && (
                  <div className="status-badge processing">
                    <span className="loading-indicator"></span>
                    Processing
                  </div>
                )}
              </div>
            </div>

            <form className="bridge-form" onSubmit={(e) => e.preventDefault()}>
              <div className="form-group">
                <label htmlFor="bridge-direction">Transfer Direction</label>
                <select
                  id="bridge-direction"
                  value={direction}
                  onChange={(e) =>
                    setDirection(e.target.value as BridgeDirection)
                  }
                  disabled={isProcessing}
                >
                  <option value="eth-to-sui">Ethereum → Sui</option>
                  <option value="sui-to-eth">Sui → Ethereum</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="bridge-amount">Amount</label>
                <div className="amount-input-wrapper">
                  <input
                    id="bridge-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    disabled={isProcessing}
                  />
                  <span className="token-symbol">IBT</span>
                </div>
              </div>

              <button
                onClick={handleBridge}
                disabled={!amount || !isConnected || isProcessing}
                className="bridge-button"
              >
                {isProcessing ? (
                  <span className="loading-text">
                    <span className="loading-indicator"></span>
                    Processing Transfer
                  </span>
                ) : (
                  'Bridge Tokens'
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      {error && (
        <div className="message-container">
          <div
            className={`message ${
              error.includes('Success') ? 'success' : 'error'
            }`}
          >
            <span className="message-icon"></span>
            <p>{error}</p>
            <button className="message-close" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default App;
