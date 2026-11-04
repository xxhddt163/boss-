import React, { useState, useEffect } from 'react';
import { OnlinePlayerInfo } from '../types.ts';
import { api } from '../services/api.ts';
import { formatBeijing } from '../utils/time.ts';
import { sound } from '../utils/sound.ts';
import {
  Users,
  X,
  RefreshCw,
  Search,
  Shield,
  User,
  Radio,
  Phone,
  Clock,
  CheckCircle2,
  Globe,
  Loader2,
} from 'lucide-react';

interface OnlinePlayersModalProps {
  onClose: () => void;
}

export const OnlinePlayersModal: React.FC<OnlinePlayersModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [players, setPlayers] = useState<OnlinePlayerInfo[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchOnlinePlayers = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.getOnlinePlayers();
      setPlayers(res.users);
      setTotalCount(res.totalCount);
      setLastUpdated(formatBeijing(new Date().toISOString()));
    } catch (err: any) {
      setErrorMsg(err.message || '获取在线玩家列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlinePlayers();
    // Auto refresh every 10 seconds while modal is open
    const timer = setInterval(fetchOnlinePlayers, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    sound.playClick();
    fetchOnlinePlayers();
  };

  const filteredPlayers = players.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.gameId.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.currentChannelNo && `${p.currentChannelNo}`.includes(q))
    );
  });

  const visitingCount = players.filter((p) => p.currentChannelNo !== null && p.currentChannelNo !== undefined).length;
  const lobbyCount = players.length - visitingCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-950/80 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white tracking-wide">当前在线玩家列表</h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-950 border border-emerald-800 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {totalCount} 人在线
                </span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded-full font-semibold">
                  管理员特权查看
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                实时追踪在线连接状态与频道蹲守动态 · 每10秒自动刷新
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              title="刷新在线玩家列表"
              className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats & Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>蹲守频道中:</span>
              <span className="font-mono font-bold text-white">{visitingCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>大厅浏览中:</span>
              <span className="font-mono font-bold text-white">{lobbyCount}</span>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索角色名 / 用户名 / 频道..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {loading && players.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <p className="text-sm">正在加载在线玩家数据...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center">
              <Users className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">未找到匹配的在线玩家</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery ? '尝试更改搜索条件' : '当前暂无在线玩家连接'}
              </p>
            </div>
          ) : (
            filteredPlayers.map((player, idx) => {
              const isAdmin = player.role === 'admin';
              const isGuest = player.isGuest;
              const activeChannels = player.activeChannelNos && player.activeChannelNos.length > 0
                ? player.activeChannelNos
                : (player.currentChannelNo ? [player.currentChannelNo] : []);
              const hasChannel = activeChannels.length > 0;

              return (
                <div
                  key={`${player.userId || 'guest'}_${idx}`}
                  className={`border rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isAdmin
                      ? 'bg-cyan-950/20 border-cyan-800/50 hover:border-cyan-700'
                      : isGuest
                      ? 'bg-slate-950/40 border-slate-800/80'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border ${
                        isAdmin
                          ? 'bg-cyan-950 border-cyan-700 text-cyan-300'
                          : isGuest
                          ? 'bg-slate-900 border-slate-700 text-slate-400'
                          : 'bg-purple-950/60 border-purple-800/80 text-purple-300'
                      }`}
                    >
                      {isAdmin ? (
                        <Shield className="w-5 h-5 text-cyan-400" />
                      ) : isGuest ? (
                        <Globe className="w-5 h-5 text-slate-400" />
                      ) : (
                        <User className="w-5 h-5 text-purple-400" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">
                          {player.gameId}
                        </span>
                        {!isGuest && (
                          <span className="text-xs text-slate-400 font-mono">
                            ({player.username})
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isAdmin
                              ? 'bg-cyan-950 border border-cyan-800 text-cyan-300'
                              : isGuest
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-purple-950/80 border border-purple-800 text-purple-300'
                          }`}
                        >
                          {isAdmin ? '管理员' : isGuest ? '访客' : '玩家'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        {player.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {player.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono text-slate-500">
                          <Clock className="w-3 h-3 text-slate-600" />
                          连接时间: {formatBeijing(player.connectedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Channel Status */}
                  <div className="self-end sm:self-center shrink-0">
                    {hasChannel ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-semibold shadow-sm">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>
                          正在蹲守：{activeChannels.join('、')} 频道
                          {activeChannels.length > 1 && (
                            <strong className="ml-1 text-amber-300 font-bold">({activeChannels.length}频)</strong>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3 text-slate-500" />
                        <span>大厅浏览中</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>上次刷新时间：{lastUpdated || '--'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
