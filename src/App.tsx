import React, { useState, useEffect, useMemo } from 'react';
import { api, setStoredToken, getStoredToken } from './services/api.ts';
import { wsClient } from './services/ws.ts';
import { User, ChannelComputedView, BossConfig } from './types.ts';
import { getCurrentServerTime, setServerTimeSync } from './utils/time.ts';
import { Header } from './components/Header.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { FilterBar, StatusFilter, SortOption } from './components/FilterBar.tsx';
import { ChannelRow } from './components/ChannelRow.tsx';
import { ChannelDetailModal } from './components/ChannelDetailModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AdminModal } from './components/AdminModal.tsx';
import { sound } from './utils/sound.ts';
import { AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<ChannelComputedView[]>([]);
  const [bossConfig, setBossConfig] = useState<BossConfig | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [serverTime, setServerTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hasVisitorFilter, setHasVisitorFilter] = useState<boolean>(false);
  const [hasNoteFilter, setHasNoteFilter] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<SortOption>('channel_asc');

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'change_password'>('login');
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [historyChannelNo, setHistoryChannelNo] = useState<number | null>(null);

  // Notification banners (e.g. concurrent kill click alert)
  const [bannerNotice, setBannerNotice] = useState<{ type: 'info' | 'success' | 'warn'; message: string } | null>(null);

  const showNotice = (type: 'info' | 'success' | 'warn', message: string) => {
    setBannerNotice({ type, message });
    setTimeout(() => {
      setBannerNotice(null);
    }, 4500);
  };

  // 1. Initial Load
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const res = await api.getChannels();
      setChannels(res.channels);
      setBossConfig(res.boss);
      if (res.serverTime) {
        setServerTimeSync(res.serverTime);
      }

      // Check current user if token exists
      const token = getStoredToken();
      if (token) {
        try {
          const userRes = await api.getCurrentUser();
          setCurrentUser(userRes.user);
          // Check if must change password (admin initial login requirement)
          if (userRes.user.must_change_password) {
            setAuthModalMode('change_password');
            setAuthModalOpen(true);
          }
        } catch {
          setStoredToken(null);
          setCurrentUser(null);
        }
      }
    } catch (err: any) {
      console.error('Initial fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // Connect WebSocket
    wsClient.connect();
    const unsubStatus = wsClient.subscribeStatus((connected) => {
      setWsConnected(connected);
    });

    const unsubWs = wsClient.subscribe((payload) => {
      if (payload.type === 'INIT_STATE') {
        if (payload.channels) setChannels(payload.channels);
        if (payload.boss) setBossConfig(payload.boss);
        if (payload.onlineCount !== undefined) setOnlineCount(payload.onlineCount);
      } else if (payload.type === 'CHANNELS_UPDATE') {
        if (payload.channels) setChannels(payload.channels);
      } else if (payload.type === 'ONLINE_COUNT') {
        setOnlineCount(payload.count);
      } else if (payload.type === 'CLOCK_TICK') {
        // Ticked from server
      } else if (payload.type === 'BOSS_ALERT') {
        showNotice('warn', `${payload.title}: ${payload.message}`);
      }
    });

    // 1-second interval to tick local server-synced clock
    const clockTimer = setInterval(() => {
      setServerTime(getCurrentServerTime());
    }, 1000);

    return () => {
      unsubStatus();
      unsubWs();
      clearInterval(clockTimer);
    };
  }, []);

  // Sync WS identity if user changes
  useEffect(() => {
    if (currentUser) {
      // Auto re-identify
    }
  }, [currentUser]);

  // Handlers for channel operations
  const handleVisit = async (channelNo: number) => {
    if (!currentUser) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    try {
      setActionLoading(true);
      sound.playClick();
      const res = await api.visitChannel(channelNo);
      if (res.leftOtherChannel) {
        showNotice('info', `已接单 ${channelNo} 频道（自动退出先前接单的 ${res.leftOtherChannel} 频道）`);
      } else {
        showNotice('success', `已成功接单 ${channelNo} 频道，已获得击杀操作权限！`);
      }
      // Re-fetch or WS will broadcast
    } catch (err: any) {
      showNotice('warn', err.message || '接单失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async (channelNo: number) => {
    try {
      setActionLoading(true);
      sound.playClick();
      await api.leaveChannel(channelNo);
      showNotice('info', `已退出 ${channelNo} 频道接单`);
    } catch (err: any) {
      showNotice('warn', err.message || '退单失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleKill = async (channelNo: number) => {
    if (!currentUser) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    try {
      setActionLoading(true);
      sound.playClick();
      const res = await api.recordKill(channelNo);
      sound.playEntryReached();
      showNotice('success', res.message);
    } catch (err: any) {
      showNotice('warn', err.message || '击杀提交失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setCurrentUser(null);
    showNotice('info', '已安全退出登录');
  };

  // Filter & Sort computation
  const filteredChannels = useMemo(() => {
    let result = [...channels];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Has visitor filter
    if (hasVisitorFilter) {
      result = result.filter((c) => c.active_visitors.length > 0);
    }

    // Has note filter
    if (hasNoteFilter) {
      result = result.filter((c) => c.channel_note && c.channel_note.trim().length > 0);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => {
        const matchesNo = String(c.channel_no) === q || `${c.channel_no}频道`.includes(q);
        const matchesNote = c.channel_note && c.channel_note.toLowerCase().includes(q);
        const matchesVisitor = c.active_visitors.some((v) =>
          v.game_id.toLowerCase().includes(q) || v.username.toLowerCase().includes(q)
        );
        const matchesLastKill = c.last_kill?.game_id.toLowerCase().includes(q) || c.last_kill?.kill_note?.toLowerCase().includes(q);
        return matchesNo || matchesNote || matchesVisitor || matchesLastKill;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortOption === 'channel_asc') {
        return a.channel_no - b.channel_no;
      }
      if (sortOption === 'entry_soon') {
        // waiting_entry channels with lowest remaining seconds come first
        const remA = a.remaining_seconds_entry ?? 9999999;
        const remB = b.remaining_seconds_entry ?? 9999999;
        return remA - remB;
      }
      if (sortOption === 'guaranteed_soon') {
        // in_spawn_window with lowest remaining seconds until guaranteed
        const remA = a.remaining_seconds_guaranteed ?? 9999999;
        const remB = b.remaining_seconds_guaranteed ?? 9999999;
        return remA - remB;
      }
      if (sortOption === 'killed_desc') {
        const timeA = a.last_kill ? new Date(a.last_kill.killed_at).getTime() : 0;
        const timeB = b.last_kill ? new Date(b.last_kill.killed_at).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [channels, statusFilter, hasVisitorFilter, hasNoteFilter, searchQuery, sortOption]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onlineCount={onlineCount}
        wsConnected={wsConnected}
        onOpenAuth={() => {
          setAuthModalMode('login');
          setAuthModalOpen(true);
        }}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onChangePassword={() => {
          setAuthModalMode('change_password');
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        activeTab={statusFilter}
        onSelectTab={(tab) => setStatusFilter(tab as StatusFilter)}
      />

      {/* Floating Notice Banner */}
      {bannerNotice && (
        <div className="fixed top-16 right-4 z-50 max-w-md animate-in slide-in-from-top-4 fade-in duration-200">
          <div
            className={`px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md flex items-center gap-3 text-xs font-medium ${
              bannerNotice.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                : bannerNotice.type === 'warn'
                ? 'bg-amber-950/90 border-amber-700 text-amber-200'
                : 'bg-cyan-950/90 border-cyan-700 text-cyan-200'
            }`}
          >
            {bannerNotice.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />}
            {bannerNotice.type === 'warn' && <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />}
            {bannerNotice.type === 'info' && <Info className="w-4 h-4 shrink-0 text-cyan-400" />}
            <span>{bannerNotice.message}</span>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* System & Boss Banner Strip */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-6 mb-4 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-cyan-950 border border-cyan-800/80 text-cyan-300">
                  多人实时共享
                </span>
                <span className="text-xs text-slate-400">
                  全服 1～60 频道实时联动监控
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {bossConfig?.boss_name || '驮狼雪人'} Boss 刷新时间管理系统
              </h1>
              <p className="text-xs text-slate-400 max-w-2xl">
                规则：进刷时间 = 击杀 + {bossConfig?.entry_interval || 60} 分钟，保底时间 = 击杀 + {bossConfig?.guaranteed_interval || 90} 分钟。多玩家访问频道协同蹲守，一键记录击杀，自动并发防重。
              </p>
            </div>

            {currentUser?.role === 'admin' ? (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setAdminModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <span>管理员控制中心</span>
                </button>
              </div>
            ) : !currentUser ? (
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 active:scale-95"
                >
                  <span>登录以访问频道并击杀</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* 1. Statistics Bar */}
        <StatsBar
          channels={channels}
          onlineCount={onlineCount}
          wsConnected={wsConnected}
        />

        {/* 2. Search, Filter and Sort Bar */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          hasVisitorFilter={hasVisitorFilter}
          onHasVisitorChange={setHasVisitorFilter}
          hasNoteFilter={hasNoteFilter}
          onHasNoteChange={setHasNoteFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
        />

        {/* 3. Channel Rows List (Strict Rule: One channel per row across all screens!) */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-1">
            <span>
              显示频道：<strong className="text-white font-mono">{filteredChannels.length}</strong> / 60
            </span>
            <span className="text-[11px] text-slate-400">
              提示：点击“接单”后即可点击“击杀”提交记录，点击“记录”可查看详情与补录
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-500 space-y-3">
              <div className="inline-block w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs">正在连接并加载 60 频道数据...</p>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="py-16 text-center text-slate-500 rounded-xl bg-slate-900/40 border border-slate-800">
              <p className="text-sm font-medium text-slate-400">没有找到匹配的频道</p>
              <p className="text-xs text-slate-600 mt-1">请尝试清除搜索关键字或重置筛选状态</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setHasVisitorFilter(false);
                  setHasNoteFilter(false);
                }}
                className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                重置筛选条件
              </button>
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <ChannelRow
                key={channel.channel_no}
                channel={channel}
                currentUser={currentUser}
                serverTime={serverTime}
                onVisit={handleVisit}
                onLeave={handleLeave}
                onKill={handleKill}
                onOpenHistory={(ch) => setHistoryChannelNo(ch)}
                isActionLoading={actionLoading}
              />
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SNOWMAN TRACKER · 冒险岛驮狼雪人 Boss 刷新时间管理系统 V1.1</span>
          <span>服务器时间同步基准：Asia/Shanghai (北京时间) · 多人 WebSocket 实时互联</span>
        </div>
      </footer>

      {/* Channel Kill History / Backfill / Modify Modal */}
      {historyChannelNo !== null && (
        <ChannelDetailModal
          channelNo={historyChannelNo}
          currentUser={currentUser}
          onClose={() => setHistoryChannelNo(null)}
          onRefreshChannels={fetchInitialData}
        />
      )}

      {/* Auth Modal (Login / Register / Change Password) */}
      {authModalOpen && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            showNotice('success', `欢迎回来，${user.game_id}！已同步游戏身份。`);
          }}
        />
      )}

      {/* Admin Control Center Modal */}
      {adminModalOpen && (
        <AdminModal
          onClose={() => setAdminModalOpen(false)}
          onDataChanged={fetchInitialData}
        />
      )}
    </div>
  );
}
