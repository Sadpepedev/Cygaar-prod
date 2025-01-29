import React, { useState, useEffect } from 'react';
import { createPublicClient, http, formatEther } from 'viem';
import { abstract } from 'viem/chains';
import { Coins, Trophy, Clock, Search, Crown, Sparkles } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ParticleBackground } from './components/ParticleBackground';

const CYGAAR_ADDRESS = '0x35EfA4699EdD7b468CBBf4FfF7B6e7AFC0A7aDa6';
const UNISWAP_POOL = '0xBe01179F2291773D220Eae55Ee85b417F40342d0';
const START_BLOCK = 257810n;
const POINTS_PER_TOKEN = 0.0000000001;
const POINTS_PER_LEVEL = 650;
const LEADERBOARD_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const publicClient = createPublicClient({
  chain: abstract,
  transport: http()
});

interface PointsData {
  balance: string;
  points: number;
  blocksHeld: number;
  level: number;
}

interface LeaderboardEntry {
  address: string;
  points: number;
  last_updated: string;
}

function App() {
  const { address: connectedAddress } = useAccount();
  const [address, setAddress] = useState('');
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (connectedAddress) {
      setAddress(connectedAddress);
      calculatePoints(connectedAddress);
    }
  }, [connectedAddress]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, LEADERBOARD_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('points_leaderboard')
      .select('*')
      .neq('address', UNISWAP_POOL)
      .order('points', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching leaderboard:', error);
    } else {
      setLeaderboard(data);
    }
  };

  const calculateLevel = (points: number) => {
    return Math.floor(points / POINTS_PER_LEVEL) + 1;
  };

  const calculatePoints = async (addressToCheck = address) => {
    if (!addressToCheck) {
      setError('Please enter an address');
      return;
    }

    if (addressToCheck.toLowerCase() === UNISWAP_POOL.toLowerCase()) {
      setError('This address is not eligible for points tracking');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setShowPointsAnimation(false);
      setShowLevelUp(false);

      const currentBlock = await publicClient.getBlockNumber();
      const balance = await publicClient.readContract({
        address: CYGAAR_ADDRESS,
        abi: [{
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }],
        functionName: 'balanceOf',
        args: [addressToCheck]
      });

      const blocksHeld = Number(currentBlock - START_BLOCK);
      const tokenBalance = Number(formatEther(balance as bigint));
      const points = tokenBalance * POINTS_PER_TOKEN * blocksHeld;
      const level = calculateLevel(points);

      const pointsData = {
        balance: tokenBalance.toFixed(2),
        points: points,
        blocksHeld,
        level
      };

      setPointsData(pointsData);
      setShowPointsAnimation(true);
      setShowLevelUp(true);

      const { error: upsertError } = await supabase
        .from('points_leaderboard')
        .upsert({
          address: addressToCheck.toLowerCase(),
          points: points,
          last_updated: new Date().toISOString()
        });

      if (upsertError) {
        console.error('Error updating leaderboard:', upsertError);
      } else {
        fetchLeaderboard();
      }

    } catch (err) {
      setError('Error fetching data. Please check the address and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      calculatePoints();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white relative overflow-hidden">
      <ParticleBackground />
      
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="absolute top-4 right-4">
          <ConnectButton />
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12 py-4">
            <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 animate-pulse leading-normal md:leading-normal">
              Cygaar Points Tracker
            </h1>
            <p className="text-gray-300 text-base md:text-lg">
              Track your points earned from holding Cygaar tokens
            </p>
          </div>

          <div className="bg-black/30 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-8 shadow-2xl border border-purple-500/20 transition-all duration-300 hover:border-purple-500/40">
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter wallet address"
                  className="w-full px-4 py-3 bg-purple-900/20 rounded-lg border border-purple-500/20 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 transition-all duration-300 text-sm md:text-base"
                />
                <button
                  onClick={() => calculatePoints()}
                  disabled={loading}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 text-sm md:text-base whitespace-nowrap"
                >
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                  Calculate
                </button>
              </div>
              {error && (
                <p className="text-red-400 mt-2 animate-fade-in text-sm md:text-base">
                  <span className="inline-block align-middle mr-2">⚠️</span>
                  {error}
                </p>
              )}
            </div>

            {loading && (
              <div className="text-center py-6 md:py-8">
                <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-purple-500 mx-auto"></div>
                <p className="mt-4 text-gray-300 text-sm md:text-base">Calculating points...</p>
              </div>
            )}

            {pointsData && (
              <>
                <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 ${showPointsAnimation ? 'animate-fade-in' : ''}`}>
                  <div className="bg-purple-900/30 p-4 md:p-6 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:transform hover:scale-105">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <Coins className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                      <h3 className="text-base md:text-lg font-semibold">Token Balance</h3>
                    </div>
                    <p className="text-xl md:text-2xl font-bold">{pointsData.balance}</p>
                  </div>

                  <div className="bg-blue-900/30 p-4 md:p-6 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:transform hover:scale-105">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <Trophy className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                      <h3 className="text-base md:text-lg font-semibold">Total Points</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xl md:text-2xl font-bold break-all">{pointsData.points.toFixed(2)}</p>
                      {showPointsAnimation && (
                        <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 animate-bounce flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="bg-indigo-900/30 p-4 md:p-6 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 hover:transform hover:scale-105">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                      <h3 className="text-base md:text-lg font-semibold">Blocks Held</h3>
                    </div>
                    <p className="text-xl md:text-2xl font-bold">{pointsData.blocksHeld.toLocaleString()}</p>
                  </div>
                </div>

                {showLevelUp && (
                  <div className="mt-6 text-center bg-gradient-to-r from-yellow-500/20 via-yellow-400/20 to-yellow-500/20 p-4 rounded-lg animate-fade-in">
                    <h3 className="text-2xl font-bold text-yellow-400 mb-2">
                      🎉 Congratulations! 🎉
                    </h3>
                    <p className="text-yellow-200">
                      You are Level {pointsData.level}!
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 md:mt-12">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 justify-center">
                <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                <h2 className="text-xl md:text-2xl font-bold">Leaderboard</h2>
              </div>
              <div className="bg-black/20 rounded-xl border border-yellow-500/20 overflow-x-auto hover:border-yellow-500/40 transition-all duration-300">
                <table className="w-full">
                  <thead>
                    <tr className="bg-yellow-500/10">
                      <th className="px-4 md:px-6 py-3 md:py-4 text-left text-sm md:text-base">Rank</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-left text-sm md:text-base">Address</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-right text-sm md:text-base">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr 
                        key={entry.address} 
                        className="border-t border-yellow-500/10 hover:bg-yellow-500/5 transition-colors duration-200"
                      >
                        <td className="px-4 md:px-6 py-3 md:py-4 text-sm md:text-base">
                          {index === 0 ? '👑' : `#${index + 1}`}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 font-mono text-sm md:text-base">{shortenAddress(entry.address)}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-right font-bold text-sm md:text-base">{entry.points.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-8 text-center text-gray-400 text-xs md:text-sm">
            <p>Points are calculated at a rate of {POINTS_PER_TOKEN} points per token per block</p>
            <p>Starting from block {START_BLOCK.toString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;