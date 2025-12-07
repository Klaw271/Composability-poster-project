'use client';

import {useState, useEffect} from "react";
import Web3 from "web3";
import { PosterABI } from '../utils/contractABI';
import { TokenABI } from '../utils/tokenABI';

// Адреса контрактов
const POSTER_ADDRESS = "0x60349E3B0A05dbd8BE334f67B48e2e58012C02bc";
const TOKEN_ADDRESS = "0x96C12162c7DC9FBec711112513E1817cbdF80980"; // Ваш токен

const SEPOLIA_CHAIN_ID = '0xaa36a7';
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export default function Home() {
  const [web3, setWeb3] = useState(undefined);
  const [userAddress, setUserAddress] = useState(undefined);
  const [posterContract, setPosterContract] = useState(undefined);
  const [tokenContract, setTokenContract] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [filterTag, setFilterTag] = useState('');
  const [newPost, setNewPost] = useState({ content: '', tag: '' });
  const [loading, setLoading] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  
  // Новые состояния для проверки баланса
  const [userTokenBalance, setUserTokenBalance] = useState('0');
  const [threshold, setThreshold] = useState('0');
  const [hasEnoughTokens, setHasEnoughTokens] = useState(false);
  const [balanceCheckLoading, setBalanceCheckLoading] = useState(false);

  // Проверка сети
  const checkNetwork = async () => {
    if (typeof window.ethereum === 'undefined') return false;
    
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    const correct = chainId === SEPOLIA_CHAIN_ID;
    setIsCorrectNetwork(correct);
    return correct;
  };

  // Переключение на Sepolia
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Test Network',
            rpcUrls: [SEPOLIA_RPC_URL],
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18
            },
            blockExplorerUrls: ['https://sepolia.etherscan.io']
          }]
        });
      }
    }
  };

  // Проверка баланса токенов
  const checkTokenBalance = async () => {
    if (!tokenContract || !posterContract || !userAddress) return;
    
    setBalanceCheckLoading(true);
    try {
      // Получаем баланс пользователя
      const balance = await tokenContract.methods.balanceOf(userAddress).call();
      
      // Получаем порог из Poster контракта
      const thresholdValue = await posterContract.methods.threshold().call();
      
      // Получаем адрес токена из Poster (для проверки)
      const tokenAddressFromPoster = await posterContract.methods.tokenAddress().call();
      
      console.log("Token balance:", balance);
      console.log("Threshold:", thresholdValue);
      console.log("Token address from Poster:", tokenAddressFromPoster);
      
      // Конвертируем в BigInt для сравнения
      const balanceBigInt = BigInt(balance);
      const thresholdBigInt = BigInt(thresholdValue);
      
      setUserTokenBalance(balance.toString());
      setThreshold(thresholdValue.toString());
      setHasEnoughTokens(balanceBigInt >= thresholdBigInt);
      
      // Проверяем что адрес токена совпадает
      if (tokenAddressFromPoster.toLowerCase() !== TOKEN_ADDRESS.toLowerCase()) {
        console.warn("Token address mismatch!");
      }
      
    } catch (error) {
      console.error('Error checking token balance:', error);
    } finally {
      setBalanceCheckLoading(false);
    }
  };

  const handleConnect = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask!');
      return;
    }

    try {
      // Проверяем и переключаем сеть если нужно
      const isCorrect = await checkNetwork();
      if (!isCorrect) {
        await switchToSepolia();
        setTimeout(async () => {
          await checkNetwork();
        }, 1000);
        return;
      }

      const web3Instance = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Инициализируем оба контракта
      const posterInstance = new web3Instance.eth.Contract(PosterABI, POSTER_ADDRESS);
      const tokenInstance = new web3Instance.eth.Contract(TokenABI, TOKEN_ADDRESS);
      
      setWeb3(web3Instance);
      setUserAddress(accounts[0]);
      setPosterContract(posterInstance);
      setTokenContract(tokenInstance);
      
      // Загружаем посты и проверяем баланс
      await loadPosts(posterInstance);
      await checkTokenBalance();
      
    } catch (error) {
      console.error('Connection error:', error);
      alert('Error connecting to wallet: ' + error.message);
    }
  };

  // Загрузка постов
  const loadPosts = async (contractInstance = posterContract) => {
    if (!contractInstance) return;

    try {
      const events = await contractInstance.getPastEvents('NewPost', {
        fromBlock: 0,
        toBlock: 'latest'
      });

      const postsData = events.map(event => ({
        user: event.returnValues.user,
        content: event.returnValues.content,
        tag: event.returnValues.tag,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      }));

      setPosts(postsData.reverse());
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  // Форматирование числа с decimals
  const formatTokens = (amount, decimals = 18) => {
  if (!amount || amount === '0') return '0';
  
  try {
    const amountBigInt = BigInt(amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = amountBigInt / divisor;
    const fractional = amountBigInt % divisor;
    
    if (fractional === 0n) {
      return whole.toString();
    }
    
    const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractionalStr}`;
  } catch (error) {
    console.error("Error formatting tokens:", error);
    return amount;
  }
};

  // Создание поста с проверкой баланса и детальной отладкой
const handlePost = async () => {
  if (!posterContract || !newPost.content || !newPost.tag) {
    alert('Please fill all fields');
    return;
  }

  if (!hasEnoughTokens) {
    alert(`❌ Insufficient tokens! You need at least ${formatTokens(threshold)} tokens, but you have ${formatTokens(userTokenBalance)}.`);
    return;
  }

  setLoading(true);
  try {
    // Оцениваем газ
    const gasEstimate = await posterContract.methods.post(
      newPost.content, 
      newPost.tag
    ).estimateGas({
      from: userAddress
    });

    // Безопасное вычисление gas limit (используем BigInt)
    const gasLimit = (gasEstimate * 150n / 100n).toString(); // +50% запас
    
    console.log("Gas estimate:", gasEstimate.toString());
    console.log("Gas limit:", gasLimit);

    // Отправляем транзакцию
    const tx = await posterContract.methods.post(newPost.content, newPost.tag).send({
      from: userAddress,
      gas: gasLimit
    });

    console.log("Transaction hash:", tx.transactionHash);
    
    setNewPost({ content: '', tag: '' });
    await loadPosts();
    await checkTokenBalance();
    alert('✅ Post created successfully!');
    
  } catch (error) {
    console.error('Error posting:', error);
    
    let errorMessage = 'Error creating post: ';
    if (error.message.includes('execution reverted')) {
      errorMessage = 'Transaction failed. Check your token balance.';
    } else if (error.message.includes('BigInt')) {
      errorMessage = 'System error. Please try again.';
    } else {
      errorMessage += error.message;
    }
    
    alert(errorMessage);
  } finally {
    setLoading(false);
  }
};

// Функция детальной диагностики
const runDetailedDiagnostics = async () => {
  console.log("=== RUNNING DIAGNOSTICS ===");
  
  try {
    // 1. Проверяем все параметры контракта Poster
    const diagnostics = {
      userAddress,
      posterAddress: POSTER_ADDRESS,
      tokenAddress: TOKEN_ADDRESS,
    };
    
    // Получаем все данные из Poster
    const posterData = await Promise.all([
      posterContract.methods.tokenAddress().call(),
      posterContract.methods.threshold().call(),
      posterContract.methods.owner().call(),
    ]);
    
    diagnostics.posterTokenAddress = posterData[0];
    diagnostics.posterThreshold = posterData[1];
    diagnostics.posterOwner = posterData[2];
    
    // Проверяем токен
    const tokenData = await Promise.all([
      tokenContract.methods.name().call(),
      tokenContract.methods.symbol().call(),
      tokenContract.methods.balanceOf(userAddress).call(),
      tokenContract.methods.decimals().call(),
    ]);
    
    diagnostics.tokenName = tokenData[0];
    diagnostics.tokenSymbol = tokenData[1];
    diagnostics.userBalance = tokenData[2];
    diagnostics.tokenDecimals = tokenData[3];
    
    // Конвертируем для сравнения
    const thresholdWithDecimals = BigInt(diagnostics.posterThreshold);
    const userBalance = BigInt(diagnostics.userBalance);
    
    diagnostics.hasEnoughTokens = userBalance >= thresholdWithDecimals;
    diagnostics.thresholdFormatted = formatTokens(diagnostics.posterThreshold, diagnostics.tokenDecimals);
    diagnostics.balanceFormatted = formatTokens(diagnostics.userBalance, diagnostics.tokenDecimals);
    
    console.log("Diagnostics result:", diagnostics);
    
    // Выводим информацию пользователю
    const diagnosticMessage = `
🔍 DIAGNOSTIC REPORT:

Poster Contract:
- Address: ${diagnostics.posterAddress}
- Token Address: ${diagnostics.posterTokenAddress}
- Threshold: ${diagnostics.thresholdFormatted} tokens
- Owner: ${diagnostics.posterOwner}

Token Contract:
- Name: ${diagnostics.tokenName}
- Symbol: ${diagnostics.tokenSymbol}
- Your Balance: ${diagnostics.balanceFormatted} tokens
- Decimals: ${diagnostics.tokenDecimals}

Status:
- Token addresses match: ${diagnostics.posterTokenAddress.toLowerCase() === TOKEN_ADDRESS.toLowerCase()}
- Has enough tokens: ${diagnostics.hasEnoughTokens}
- Need: ${diagnostics.thresholdFormatted}, Have: ${diagnostics.balanceFormatted}

${!diagnostics.hasEnoughTokens ? '❌ PROBLEM: Insufficient tokens!' : '✅ All checks passed'}
${diagnostics.posterTokenAddress.toLowerCase() !== TOKEN_ADDRESS.toLowerCase() ? '❌ PROBLEM: Token address mismatch!' : ''}
    `;
    
    alert(diagnosticMessage);
    
  } catch (diagnosticError) {
    console.error("Diagnostic failed:", diagnosticError);
    alert("Diagnostic failed: " + diagnosticError.message);
  }
};

  // Фильтрация
  const filteredPosts = filterTag 
    ? posts.filter(post => {
        const filterTagHash = Web3.utils.keccak256(filterTag);
        return post.tag.toLowerCase() === filterTagHash.toLowerCase();
      })
    : posts;

  // Обновляем баланс при изменении адреса
  useEffect(() => {
    if (userAddress && tokenContract && posterContract) {
      checkTokenBalance();
    }
  }, [userAddress, tokenContract, posterContract]);

  // Слушаем изменения сети и аккаунта
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return;

    checkNetwork();

    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        setUserAddress(accounts[0]);
      } else {
        setUserAddress(undefined);
        setUserTokenBalance('0');
        setHasEnoughTokens(false);
      }
    };

    const handleChainChanged = (chainId) => {
      setIsCorrectNetwork(chainId === SEPOLIA_CHAIN_ID);
      if (chainId === SEPOLIA_CHAIN_ID) {
        window.location.reload();
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>📝 Poster dApp - Sepolia Testnet</h1>
      
      {!userAddress ? (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <button 
            onClick={handleConnect}
            style={{ 
              padding: '15px 30px', 
              fontSize: '18px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔗 Connect MetaMask Wallet
          </button>
          <p style={{ marginTop: '20px', color: '#666' }}>
            Connect your wallet to start posting messages
          </p>
        </div>
      ) : !isCorrectNetwork ? (
        <div>
          <p style={{ color: 'red' }}>Wrong network. Please switch to Sepolia Testnet</p>
          <button onClick={switchToSepolia}>Switch to Sepolia</button>
        </div>
      ) : (
        <div>
          <div style={{ 
            marginBottom: '20px', 
            padding: '15px', 
            border: '2px solid #e0e0e0', 
            borderRadius: '10px',
            backgroundColor: '#f9f9f9'
          }}>
            <p><strong>Connected:</strong> {userAddress}</p>
            
            <div style={{ marginTop: '10px' }}>
              {balanceCheckLoading ? (
                <p>Checking token balance...</p>
              ) : (
                <>
                  <p>
                    <strong>Token Balance:</strong> {formatTokens(userTokenBalance)} tokens
                  </p>
                  <p>
                    <strong>Posting Threshold:</strong> {formatTokens(threshold)} tokens
                  </p>
                  <p style={{ 
                    color: hasEnoughTokens ? 'green' : 'red',
                    fontWeight: 'bold'
                  }}>
                    {hasEnoughTokens ? '✅ Sufficient tokens for posting' : '❌ Insufficient tokens for posting'}
                  </p>
                </>
              )}
            </div>
            
            <button 
              onClick={checkTokenBalance}
              style={{ 
                marginTop: '10px', 
                padding: '5px 10px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh Balance
            </button>
          </div>
          
          {/* Форма создания поста */}
          <div style={{ 
            margin: '20px 0', 
            padding: '20px', 
            border: '1px solid #ccc',
            borderRadius: '8px',
            backgroundColor: '#fff'
          }}>
            <h3>Create New Post</h3>
            
            {!hasEnoughTokens && (
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#ffebee', 
                borderLeft: '4px solid #f44336',
                marginBottom: '15px'
              }}>
                ⚠️ You don't have enough tokens to post. 
                You need at least {formatTokens(threshold)} tokens, but you only have {formatTokens(userTokenBalance)}.
              </div>
            )}
            
            <textarea
              placeholder="Enter your message..."
              value={newPost.content}
              onChange={(e) => setNewPost({...newPost, content: e.target.value})}
              style={{ 
                width: '100%', 
                height: '80px', 
                marginBottom: '10px',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              disabled={!hasEnoughTokens}
            />
            <input
              type="text"
              placeholder="Tag (e.g., general, news, fun)"
              value={newPost.tag}
              onChange={(e) => setNewPost({...newPost, tag: e.target.value})}
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginBottom: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              disabled={!hasEnoughTokens}
            />
            <button 
              onClick={handlePost} 
              disabled={loading || !hasEnoughTokens}
              style={{ 
                padding: '10px 20px',
                backgroundColor: hasEnoughTokens ? '#4CAF50' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: hasEnoughTokens ? 'pointer' : 'not-allowed'
              }}
            >
              {loading ? 'Posting...' : hasEnoughTokens ? 'Post Message' : 'Insufficient Tokens'}
            </button>
          </div>

          {/* Фильтр и посты */}
          <div style={{ margin: '20px 0' }}>
            <input
              type="text"
              placeholder="Filter by tag..."
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <h3>Posts {filterTag && `(filtered by: ${filterTag})`}</h3>
            {filteredPosts.length === 0 ? (
              <p>No posts yet. Be the first to post!</p>
            ) : (
              filteredPosts.map((post, index) => (
                <div key={index} style={{ 
                  border: '1px solid #eee', 
                  padding: '15px', 
                  margin: '10px 0',
                  borderRadius: '8px',
                  backgroundColor: '#fafafa'
                }}>
                  <p><strong>Message:</strong> {post.content}</p>
                  <p><strong>Tag:</strong> {post.tag}</p>
                  <p><strong>Author:</strong> {post.user}</p>
                  <p style={{ fontSize: '12px', color: '#666' }}>
                    Block: {post.blockNumber}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {userAddress && (
  <div style={{ marginTop: '10px' }}>
    <button 
      onClick={runDetailedDiagnostics}
      style={{ 
        padding: '8px 15px',
        backgroundColor: '#ff9800',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
      }}
    >
      🐛 Run Diagnostics
    </button>
  </div>
)}
    </div>
  );
}
