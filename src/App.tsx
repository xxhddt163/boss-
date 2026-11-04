import React, { useState, useEffect, useMemo } from 'react';
import { api, setStoredToken, getStoredToken } from './services/api.ts';
import { wsClient } from './services/ws.ts';
import { User, ChannelComputedView, BossConfig } from './types.ts';
import { getCurrentServerTime, setServerTimeSync } from './utils/time.ts';
import { Header } from './components/Header.tsx';
import { StatsBar } from './components/StatsBar.tsx';
import { FilterBar, StatusFilter, SortOption } from './components/FilterBar.tsx';
import { ChannelRow } from './components/ChannelRow.tsx';
import { ChannelTableHeader } from './components/ChannelTableHeader.tsx';
import { ChannelDetailModal } from './components/ChannelDetailModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { AdminModal } from './components/AdminModal.tsx';
import { LoginPortal } from './components/LoginPortal.tsx';
import { KillConfirmModal } from './components/KillConfirmModal.tsx';
import { AdminKillStatsSection } from './components/AdminKillStatsSection.tsx';
import { PendingApprovalModal } from './components/PendingApprovalModal.tsx';
import { sound, sendDesktopNotification } from './utils/sound.ts';
import { AlertCircle, CheckCircle, Info, RotateCcw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<ChannelComputedView[]>([]);
  const [bossConfig, setBossConfig] = useState<BossConfig | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [serverTime, setServerTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [statsLastUpdate, setStatsLastUpdate] = useState<number>(Date.now());

  // Admin Pending Users Review state
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);
  const [pendingModalOpen, setPendingModalOpen] = useState<boolean>(false);

  // Tracking alerts already announced for a specific channel and kill round
  const handledAlertsRef = React.useRef<Set<string>>(new Set());
  const channelsRef = React.useRef<ChannelComputedView[]>([]);

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
  const [confirmKillChannelNo, setConfirmKillChannelNo] = useState<number | null>(null);
  const [resetConfirmChannelNo, setResetConfirmChannelNo] = useState<number | null>(null);

  // Notification banners (e.g. concurrent kill click alert)
  const [bannerNotice, setBannerNotice] = useState<{ type: 'info' | 'success' | 'warn'; message: string } | null>(null);

  const showNotice = (type: 'info' | 'success' | 'warn', message: string) => {
    setBannerNotice({ type, message });
    setTimeout(() => {
      setBannerNotice(null);
    }, 4500);
  };

  // Check pending users for administrator
  const checkPendingUsers = async (triggerAlerts: boolean = false) => {
    try {
      const res = await api.getPendingUsers();
      setPendingUsers(res.users);
      setPendingUsersCount(res.count);
      if (res.count > 0 && triggerAlerts) {
        setPendingModalOpen(true);
        sound.speakPendingAuditReminder(res.count);
      }
    } catch {
      // ignore non-admin or unauthenticated
    }
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
          // If admin, check pending registrations
          if (userRes.user.role === 'admin') {
            if (userRes.pendingUsersCount !== undefined) {
              setPendingUsers(userRes.pendingUsers || []);
              setPendingUsersCount(userRes.pendingUsersCount);
              if (userRes.pendingUsersCount > 0) {
                setPendingModalOpen(true);
                sound.speakPendingAuditReminder(userRes.pendingUsersCount);
              }
            } else {
              checkPendingUsers(true);
            }
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
    channelsRef.current = channels;
  }, [channels]);

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
        setStatsLastUpdate(Date.now());
      } else if (payload.type === 'CHANNELS_UPDATE') {
        if (payload.channels) setChannels(payload.channels);
        setStatsLastUpdate(Date.now());
      } else if (payload.type === 'ONLINE_COUNT') {
        setOnlineCount(payload.count);
      } else if (payload.type === 'CLOCK_TICK') {
        // Ticked from server
      } else if (payload.type === 'BOSS_ALERT') {
        const key = payload.alert_key || `${payload.channel_no}_${payload.kill_id || ''}_${payload.stage}`;
        if (!handledAlertsRef.current.has(key)) {
          handledAlertsRef.current.add(key);
          if (payload.stage === 'before_entry') {
            sound.speakBeforeEntry(payload.channel_no);
            sendDesktopNotification(payload.title, payload.message);
          } else if (payload.stage === 'entry_reached') {
            sound.speakEntryReached(payload.channel_no);
            sendDesktopNotification(payload.title, payload.message);
          } else if (payload.stage === 'guaranteed_reached') {
            sound.playGuaranteedReached();
            sendDesktopNotification(payload.title, payload.message);
          }
        }
        showNotice('warn', `${payload.title}: ${payload.message}`);
      }
    });

    // 1-second interval to tick local server-synced clock & evaluate alerts locally
    const clockTimer = setInterval(() => {
      const now = getCurrentServerTime();
      setServerTime(now);
      const nowMs = now.getTime();

      // Check transitions locally to guarantee female voice broadcast fires promptly even if WS drops momentarily
      channelsRef.current.forEach((ch) => {
        if (!ch.last_kill || ch.last_kill.is_void) return;
        const killId = ch.last_kill.id;
        const entryMs = new Date(ch.last_kill.entry_at).getTime();
        const guaranteedMs = ch.last_kill.guaranteed_at ? new Date(ch.last_kill.guaranteed_at).getTime() : 0;
        const reminderMs = 5 * 60 * 1000;

        // 1. 5 minutes before entry: 女声语音播报“XX频道距离进入刷时间仅剩5分钟”
        const before5mKey = `${ch.channel_no}_${killId}_before_5m`;
        if (nowMs >= entryMs - reminderMs && nowMs < entryMs) {
          if (!handledAlertsRef.current.has(before5mKey)) {
            handledAlertsRef.current.add(before5mKey);
            sound.speakBeforeEntry(ch.channel_no);
            sendDesktopNotification(
              `${ch.channel_no}频道 即将进刷`,
              `${ch.channel_no}频道 距离进刷仅剩 5 分钟（进刷时间 ${ch.entry_at_display}）`
            );
            showNotice('warn', `${ch.channel_no}频道 即将进刷: 距离进刷仅剩 5 分钟`);
          }
        }

        // 2. Reached entry time: 女声语音播报“XX频道已进入刷时间，请注意蹲守击杀”
        const entryKey = `${ch.channel_no}_${killId}_entry`;
        if (nowMs >= entryMs && (guaranteedMs === 0 || nowMs < guaranteedMs)) {
          if (!handledAlertsRef.current.has(entryKey)) {
            handledAlertsRef.current.add(entryKey);
            sound.speakEntryReached(ch.channel_no);
            sendDesktopNotification(
              `${ch.channel_no}频道 已进入刷时间`,
              `${ch.channel_no}频道 已经可以刷新，请蹲守击杀！`
            );
            showNotice('warn', `${ch.channel_no}频道 已进入刷时间: 请注意蹲守击杀！`);
          }
        }

        // 3. Reached guaranteed time
        const guaranteedKey = `${ch.channel_no}_${killId}_guaranteed`;
        if (guaranteedMs > 0 && nowMs >= guaranteedMs) {
          if (!handledAlertsRef.current.has(guaranteedKey)) {
            handledAlertsRef.current.add(guaranteedKey);
            sound.playGuaranteedReached();
            sendDesktopNotification(
              `${ch.channel_no}频道 已到保底`,
              `${ch.channel_no}频道 已达保底时间（${ch.guaranteed_at_display}），请火速确认击杀！`
            );
            showNotice('warn', `${ch.channel_no}频道 已到保底: 请火速确认击杀！`);
          }
        }
      });
    }, 1000);

    return () => {
      unsubStatus();
      unsubWs();
      clearInterval(clockTimer);
    };
  }, []);

  // Handlers for channel operations
  const handleVisit = async (channelNo: number) => {
    if (!currentUser) return;
    try {
      setActionLoading(true);
      sound.playClick();
      const res = await api.visitChannel(channelNo);
      if (res.leftOtherChannel) {
        showNotice('info', `已接单 ${channelNo} 频道（自动退出先前接单的 ${res.leftOtherChannel} 频道）`);
      } else {
        showNotice('success', `已成功接单 ${channelNo} 频道，已自动登记您的角色 ID！`);
      }
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
      showNotice('info', `已退单 ${channelNo} 频道并清除登记`);
    } catch (err: any) {
      showNotice('warn', err.message || '退单失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Issue 5: Prompt Kill confirmation modal
  const handleRequestKill = (channelNo: number) => {
    if (!currentUser) return;
    setConfirmKillChannelNo(channelNo);
  };

  // Issue 2, 4 & 5: Confirm and submit Kill
  const handleConfirmKill = async () => {
    if (!currentUser || confirmKillChannelNo === null) return;
    try {
      setActionLoading(true);
      sound.playClick();
      const res = await api.recordKill(confirmKillChannelNo);
      sound.playEntryReached();
      setStatsLastUpdate(Date.now());
      showNotice('success', `${res.message}，已自动完成并清除本次接单！`);
      setConfirmKillChannelNo(null);
    } catch (err: any) {
      showNotice('warn', err.message || '击杀提交失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin: Request Reset Channel Times
  const handleRequestReset = (channelNo: number) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setResetConfirmChannelNo(channelNo);
  };

  // Admin: Confirm Reset Channel Times
  const handleConfirmReset = async () => {
    if (!currentUser || currentUser.role !== 'admin' || resetConfirmChannelNo === null) return;
    try {
      setActionLoading(true);
      sound.playClick();
      await api.resetChannelTimes(resetConfirmChannelNo);
      showNotice('success', `【管理员操作】已成功将 ${resetConfirmChannelNo} 频道的所有时间信息初始化至空！`);
      setResetConfirmChannelNo(null);
    } catch (err: any) {
      showNotice('warn', err.message || '重置频道失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Issue 3: Channel tag update by logged-in users
  const handleUpdateTag = async (channelNo: number, tag: string) => {
    if (!currentUser) return;
    try {
      sound.playClick();
      setChannels((prev) =>
        prev.map((c) => (c.channel_no === channelNo ? { ...c, channel_tag: tag } : c))
      );
      await api.updateChannelTag(channelNo, tag);
      showNotice(
        'success',
        tag ? `已为 ${channelNo} 频道设置标签【${tag}】` : `已清除 ${channelNo} 频道的标签`
      );
    } catch (err: any) {
      showNotice('warn', err.message || '修改标签失败');
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

    // Status filter: 已接单频道无论在哪个状态Tab中，均保持显示并置顶高亮
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter || c.active_visitors.length > 0);
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
        const matchesTag = c.channel_tag && c.channel_tag.toLowerCase().includes(q);
        const matchesVisitor = c.active_visitors.some((v) =>
          v.game_id.toLowerCase().includes(q) || v.username.toLowerCase().includes(q)
        );
        const matchesLastKill =
          c.last_kill?.game_id.toLowerCase().includes(q) || c.last_kill?.kill_note?.toLowerCase().includes(q);
        return matchesNo || matchesNote || matchesTag || matchesVisitor || matchesLastKill;
      });
    }

    // Sorting:
    // 1. My accepted channel ALWAYS comes #1 at the absolute top row
    // 2. All other accepted channels (ordered by other players) are ALSO pinned right below
    // 3. Un-ordered channels follow according to user's selected sortOption
    result.sort((a, b) => {
      const aHasMe = currentUser
        ? a.active_visitors.some((v) => v.user_id === currentUser.id)
        : false;
      const bHasMe = currentUser
        ? b.active_visitors.some((v) => v.user_id === currentUser.id)
        : false;
      if (aHasMe && !bHasMe) return -1;
      if (!aHasMe && bHasMe) return 1;

      const aHasOther = a.active_visitors.length > 0;
      const bHasOther = b.active_visitors.length > 0;
      if (aHasOther && !bHasOther) return -1;
      if (!aHasOther && bHasOther) return 1;

      // Dropdown overrides:
      if (sortOption === 'entry_soon') {
        const remA = a.remaining_seconds_entry ?? 9999999;
        const remB = b.remaining_seconds_entry ?? 9999999;
        if (remA !== remB) return remA - remB;
      } else if (sortOption === 'guaranteed_soon') {
        const remA = a.remaining_seconds_guaranteed ?? 9999999;
        const remB = b.remaining_seconds_guaranteed ?? 9999999;
        if (remA !== remB) return remA - remB;
      } else if (sortOption === 'killed_desc') {
        const timeA = a.last_kill ? new Date(a.last_kill.killed_at).getTime() : 0;
        const timeB = b.last_kill ? new Date(b.last_kill.killed_at).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
      }

      // Default & Comprehensive sorting:
      // 1. 有时间记录的频道排在前面，按击杀时间排序（01:01:00 在 01:05:00 上方）
      // 2. 未记录的频道排在后面，按频道编号 1~60 顺序排列
      const hasKillA = !!a.last_kill;
      const hasKillB = !!b.last_kill;

      if (hasKillA && !hasKillB) return -1;
      if (!hasKillA && hasKillB) return 1;

      if (hasKillA && hasKillB) {
        const timeA = new Date(a.last_kill!.killed_at).getTime();
        const timeB = new Date(b.last_kill!.killed_at).getTime();
        if (timeA !== timeB) {
          return timeA - timeB; // 01:01:00 比 01:05:00 靠前
        }
        return a.channel_no - b.channel_no;
      }

      // 双方均未记录时，按频道号顺序排列
      return a.channel_no - b.channel_no;
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
        pendingUsersCount={currentUser?.role === 'admin' ? pendingUsersCount : 0}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onChangePassword={() => {
          setAuthModalMode('change_password');
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
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

      {/* Main Content Viewport: Issue 1 - if !currentUser, show dedicated LoginPortal directly */}
      {!currentUser ? (
        <LoginPortal
          onLoginSuccess={(user, pendingInfo) => {
            setCurrentUser(user);
            showNotice('success', `登录成功，欢迎回来：${user.game_id}！已解锁频道监控。`);
            if (user.must_change_password) {
              setAuthModalMode('change_password');
              setAuthModalOpen(true);
            }
            if (user.role === 'admin') {
              if (pendingInfo && pendingInfo.count > 0) {
                setPendingUsers(pendingInfo.users);
                setPendingUsersCount(pendingInfo.count);
                setPendingModalOpen(true);
                sound.speakPendingAuditReminder(pendingInfo.count);
              } else {
                checkPendingUsers(true);
              }
            }
          }}
        />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-6 py-4">
          {/* System & Boss Banner Strip */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-6 mb-4 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-cyan-950 border border-cyan-800/80 text-cyan-300">
                    多人实时共享
                  </span>
                  <span className="text-xs text-slate-400">
                    全服 1～60 频道实时联动监控 · 登录角色：<strong className="text-purple-300 font-semibold">{currentUser.game_id}</strong>
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {bossConfig?.boss_name || '驮狼雪人'} Boss 刷新时间管理系统
                </h1>
              </div>

              {currentUser.role === 'admin' && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setAdminModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
                  >
                    <span>管理员控制中心</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Admin Pending Users Review Banner */}
          {currentUser.role === 'admin' && pendingUsersCount > 0 && (
            <div className="mb-4 bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 border border-amber-500/50 rounded-xl p-3.5 sm:p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-amber-200">待审核账号提醒</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-500/30 text-amber-300">
                      {pendingUsersCount} 位玩家待审核
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    检测到有新玩家提交了注册申请，需管理员审核通过后方可登录使用。
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => setPendingModalOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>立即查看并审核</span>
                </button>
              </div>
            </div>
          )}

          {/* Admin Kill Statistics: 每日，每周，每月，每个人的击杀总数，条形图与饼状图 (仅管理员可见) */}
          {currentUser.role === 'admin' && (
            <AdminKillStatsSection
              currentUser={currentUser}
              lastUpdateTimestamp={statsLastUpdate}
            />
          )}

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

          {/* 3. Channel Rows List with Frozen Sticky Table Header */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-2">
              <span>
                显示频道：<strong className="text-white font-mono">{filteredChannels.length}</strong> / 60
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
                  className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  重置筛选条件
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                {/* Frozen / Sticky Table Header */}
                <ChannelTableHeader />

                {/* Streamlined Channel Rows */}
                <div className="space-y-2.5 mt-2">
                  {filteredChannels.map((channel) => (
                    <ChannelRow
                      key={channel.channel_no}
                      channel={channel}
                      currentUser={currentUser}
                      serverTime={serverTime}
                      onVisit={handleVisit}
                      onLeave={handleLeave}
                      onKill={handleRequestKill}
                      onOpenHistory={(ch) => setHistoryChannelNo(ch)}
                      onReset={handleRequestReset}
                      onUpdateTag={handleUpdateTag}
                      isActionLoading={actionLoading}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}



      {/* Issue 5: Kill Confirmation Modal */}
      {confirmKillChannelNo !== null && (
        <KillConfirmModal
          channelNo={confirmKillChannelNo}
          gameId={currentUser?.game_id || ''}
          onConfirm={handleConfirmKill}
          onCancel={() => setConfirmKillChannelNo(null)}
          loading={actionLoading}
        />
      )}

      {/* Admin Reset Channel Confirmation Modal */}
      {resetConfirmChannelNo !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 border border-amber-500/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-full bg-amber-950/80 border border-amber-600/50">
                <RotateCcw className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  重置 {resetConfirmChannelNo} 频道时间信息
                </h3>
                <p className="text-xs text-amber-300/80 font-medium">管理员专属操作</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              确定要将 <strong className="text-amber-300">{resetConfirmChannelNo} 频道</strong> 的所有时间信息初始化至空吗？<br />
              • 最近击杀时间、进刷时间、保底时间、距离进刷倒计时等将全部清空初始化至未记录状态 (<code className="text-slate-400 font-mono">--:--:--</code>)。<br />
              • 该频道的备注与标签信息将予以保留。
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmChannelNo(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 rounded-lg transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{actionLoading ? '正在重置...' : '确认初始化至空'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Kill History / Backfill / Modify Modal */}
      {historyChannelNo !== null && (
        <ChannelDetailModal
          channelNo={historyChannelNo}
          currentUser={currentUser}
          onClose={() => setHistoryChannelNo(null)}
          onRefreshChannels={() => {
            fetchInitialData();
            setStatsLastUpdate(Date.now());
          }}
        />
      )}

      {/* Auth Modal (Password Change) */}
      {authModalOpen && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            showNotice('success', `密码已更新！`);
          }}
        />
      )}

      {/* Admin Control Center Modal */}
      {adminModalOpen && (
        <AdminModal
          onClose={() => {
            setAdminModalOpen(false);
            checkPendingUsers(false);
          }}
          onDataChanged={() => {
            fetchInitialData();
            checkPendingUsers(false);
          }}
        />
      )}

      {/* Pending Accounts Approval Modal */}
      {pendingModalOpen && (
        <PendingApprovalModal
          pendingUsers={pendingUsers}
          onClose={() => setPendingModalOpen(false)}
          onOpenAdminUsers={() => {
            setPendingModalOpen(false);
            setAdminModalOpen(true);
          }}
          onUsersApproved={() => {
            checkPendingUsers(false);
            fetchInitialData();
          }}
        />
      )}
    </div>
  );
}
