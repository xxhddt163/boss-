import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api, setStoredToken, getStoredToken } from './services/api.ts';
import { wsClient } from './services/ws.ts';
import { User, ChannelComputedView, BossConfig } from './types.ts';
import { getCurrentServerTime, setServerTimeSync, formatBeijing } from './utils/time.ts';
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
import { OnlinePlayersModal } from './components/OnlinePlayersModal.tsx';
import { LeaveReasonModal } from './components/LeaveReasonModal.tsx';
import { LeaveReasonsAdminModal } from './components/LeaveReasonsAdminModal.tsx';
import { sound, sendDesktopNotification } from './utils/sound.ts';
import {
  AlertCircle,
  CheckCircle,
  Info,
  RotateCcw,
  Download,
  WifiOff,
  MessageSquareWarning,
  PictureInPicture2,
  Maximize2,
  Volume2,
  VolumeX,
  ExternalLink,
} from 'lucide-react';
import {
  exportChannelsToCSV,
  saveOfflineChannelsCache,
  loadOfflineChannelsCache,
  saveOfflineUserCache,
  loadOfflineUserCache,
} from './utils/exportChannels.ts';

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

  // Admin Online Players Modal state
  const [onlinePlayersModalOpen, setOnlinePlayersModalOpen] = useState<boolean>(false);

  // Tracking alerts already announced for a specific channel and kill round
  const handledAlertsRef = React.useRef<Set<string>>(new Set());
  const channelsRef = React.useRef<ChannelComputedView[]>([]);
  const currentUserRef = React.useRef<User | null>(null);

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
  const [leaveModalChannelNo, setLeaveModalChannelNo] = useState<number | null>(null);
  const [leaveReasonsAdminModalOpen, setLeaveReasonsAdminModalOpen] = useState<boolean>(false);

  // PC Mini Window Mode (小窗模式: 支持独立外置悬浮窗口 + 页内小窗兜底) state
  const [isMiniMode, setIsMiniMode] = useState<boolean>(false);
  const [externalRoot, setExternalRoot] = useState<HTMLElement | null>(null);
  const [miniSoundEnabled, setMiniSoundEnabled] = useState<boolean>(sound.isEnabled());
  const miniWindowRef = React.useRef<HTMLDivElement>(null);
  const externalWinRef = React.useRef<Window | null>(null);
  const styleObserverRef = React.useRef<MutationObserver | null>(null);
  const prevWindowSizeRef = React.useRef<{ width: number; height: number } | null>(null);

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
      setChannels(Array.isArray(res?.channels) ? res.channels : []);
      if (res?.boss) setBossConfig(res.boss);
      if (res?.serverTime) {
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
        } catch (authErr: any) {
          if (authErr?.status === 401 || (authErr?.message && authErr.message.includes('401'))) {
            setStoredToken(null);
            setCurrentUser(null);
            saveOfflineUserCache(null);
          } else {
            // Keep cached user on network error
            const cachedUser = loadOfflineUserCache();
            if (cachedUser) {
              setCurrentUser(cachedUser);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('Initial fetch failed, restoring offline disaster-recovery cache...', err);
      const offlineCache = loadOfflineChannelsCache();
      if (offlineCache && offlineCache.channels.length > 0) {
        setChannels(offlineCache.channels);
        if (offlineCache.boss) setBossConfig(offlineCache.boss);
        showNotice('warn', `已启用本地离线容灾快照（${offlineCache.savedAt.slice(0, 19).replace('T', ' ')}）`);
      }
      const cachedUser = loadOfflineUserCache();
      if (cachedUser) {
        setCurrentUser(cachedUser);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    channelsRef.current = Array.isArray(channels) ? channels : [];
    if (channels && channels.length > 0) {
      saveOfflineChannelsCache(channels, bossConfig);
    }
  }, [channels, bossConfig]);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      saveOfflineUserCache(currentUser);
    }
  }, [currentUser]);

  // Client-side direct export (100% offline-ready)
  const handleExportChannels = () => {
    sound.playClick();
    try {
      const activeChannels = channels.length > 0 ? channels : (loadOfflineChannelsCache()?.channels || []);
      if (!activeChannels || activeChannels.length === 0) {
        showNotice('warn', '本地暂无可导出的频道数据');
        return;
      }
      const result = exportChannelsToCSV(
        activeChannels,
        bossConfig?.boss_name || '驮狼雪人',
        !wsConnected
      );
      showNotice('success', `已成功导出 ${result.rowCount} 个频道的完整时间表格（${result.filename}）！`);
    } catch (err: any) {
      showNotice('warn', err.message || '导出表格失败');
    }
  };

  // Keep WebSocket client informed of current user identity
  useEffect(() => {
    if (currentUser) {
      wsClient.identify({
        id: currentUser.id,
        username: currentUser.username,
        game_id: currentUser.game_id,
      });
    } else {
      wsClient.identify(null);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchInitialData();

    // Connect WebSocket
    wsClient.connect();
    const unsubStatus = wsClient.subscribeStatus((connected) => {
      setWsConnected(connected);
    });

    const unsubWs = wsClient.subscribe((payload) => {
      if (payload.type === 'INIT_STATE') {
        if (Array.isArray(payload.channels)) setChannels(payload.channels);
        if (payload.boss) setBossConfig(payload.boss);
        if (payload.onlineCount !== undefined) setOnlineCount(payload.onlineCount);
        setStatsLastUpdate(Date.now());
      } else if (payload.type === 'CHANNELS_UPDATE') {
        if (Array.isArray(payload.channels)) setChannels(payload.channels);
        setStatsLastUpdate(Date.now());
      } else if (payload.type === 'ONLINE_COUNT') {
        setOnlineCount(payload.count);
      } else if (payload.type === 'CLOCK_TICK') {
        // Ticked from server
      } else if (payload.type === 'BOSS_ALERT') {
        if (!currentUserRef.current) return;
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
        showNotice('warn', `${payload.title}：${payload.message}`);
      }
    });

    // 1-second interval to tick local server-synced clock & evaluate alerts locally
    const clockTimer = setInterval(() => {
      const now = getCurrentServerTime();
      setServerTime(now);
      const nowMs = now.getTime();

      // Only logged-in users receive boss spawn alerts
      if (!currentUserRef.current) return;

      // Check transitions locally to guarantee female voice broadcast fires promptly even if WS drops momentarily
      channelsRef.current.forEach((ch) => {
        if (!ch.last_kill || ch.last_kill.is_void) return;
        const killId = ch.last_kill.id;
        const entryMs = new Date(ch.last_kill.entry_at).getTime();
        const guaranteedMs = ch.last_kill.guaranteed_at ? new Date(ch.last_kill.guaranteed_at).getTime() : 0;
        const reminderMs = 5 * 60 * 1000;

        // 1. 5 minutes before entry: 女声语音播报“XX频道 即将进刷：XX频道 距离进入刷新时间仅剩5分钟”
        const before5mKey = `${ch.channel_no}_${killId}_before_5m`;
        if (nowMs >= entryMs - reminderMs && nowMs < entryMs) {
          if (!handledAlertsRef.current.has(before5mKey)) {
            handledAlertsRef.current.add(before5mKey);
            sound.speakBeforeEntry(ch.channel_no);
            sendDesktopNotification(
              `${ch.channel_no}频道 即将进刷`,
              `${ch.channel_no}频道 距离进入刷新时间仅剩5分钟`
            );
            showNotice('warn', `${ch.channel_no}频道 即将进刷：${ch.channel_no}频道 距离进入刷新时间仅剩5分钟`);
          }
        }

        // 2. Reached entry time: 女声语音播报“XX频道 已进入刷新时间：XX频道已经可以刷新，请蹲守击杀！”
        const entryKey = `${ch.channel_no}_${killId}_entry`;
        if (nowMs >= entryMs && (guaranteedMs === 0 || nowMs < guaranteedMs)) {
          if (!handledAlertsRef.current.has(entryKey)) {
            handledAlertsRef.current.add(entryKey);
            sound.speakEntryReached(ch.channel_no);
            sendDesktopNotification(
              `${ch.channel_no}频道 已进入刷新时间`,
              `${ch.channel_no}频道已经可以刷新，请蹲守击杀！`
            );
            showNotice('warn', `${ch.channel_no}频道 已进入刷新时间：${ch.channel_no}频道已经可以刷新，请蹲守击杀！`);
          }
        }

        // 3. Reached guaranteed time
        const guaranteedKey = `${ch.channel_no}_${killId}_guaranteed`;
        if (guaranteedMs > 0 && nowMs >= guaranteedMs && nowMs - guaranteedMs < 180 * 60 * 1000) {
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

  const handleLeave = (channelNo: number) => {
    if (!currentUser) return;
    sound.playClick();
    setLeaveModalChannelNo(channelNo);
  };

  const handleConfirmLeave = async (reason: string) => {
    if (leaveModalChannelNo === null) return;
    try {
      setActionLoading(true);
      sound.playClick();
      await api.leaveChannel(leaveModalChannelNo, reason);
      showNotice('info', `已退单 ${leaveModalChannelNo} 频道（退单理由：${reason}）`);
      setLeaveModalChannelNo(null);
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

  // Helper to close and clean up any detached external mini window
  const closeExternalWindow = () => {
    if (styleObserverRef.current) {
      styleObserverRef.current.disconnect();
      styleObserverRef.current = null;
    }
    if (externalWinRef.current && !externalWinRef.current.closed) {
      try {
        externalWinRef.current.close();
      } catch {
        // ignore
      }
    }
    externalWinRef.current = null;
    setExternalRoot(null);
  };

  const handleLogout = () => {
    closeExternalWindow();
    setIsMiniMode(false);
    setStoredToken(null);
    setCurrentUser(null);
    showNotice('info', '已安全退出登录');
  };

  // Current account's accepted channels (普通用户最多1个，管理员账号接了几个就显示几个)
  const myAcceptedChannels = useMemo(() => {
    if (!currentUser) return [];
    const list = Array.isArray(channels) ? channels : [];
    const mine = list.filter(
      (c) =>
        c &&
        Array.isArray(c.active_visitors) &&
        c.active_visitors.some((v) => v && v.user_id === currentUser.id)
    );

    mine.sort((a, b) => {
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

      const hasKillA = !!a.last_kill;
      const hasKillB = !!b.last_kill;
      if (hasKillA && !hasKillB) return -1;
      if (!hasKillA && hasKillB) return 1;
      if (hasKillA && hasKillB) {
        const timeA = new Date(a.last_kill!.killed_at).getTime();
        const timeB = new Date(b.last_kill!.killed_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.channel_no - b.channel_no;
      }
      return a.channel_no - b.channel_no;
    });

    return mine;
  }, [channels, currentUser, sortOption]);

  // Enter PC Mini Window Mode: Pops out a detached independent external OS window
  const handleOpenMiniMode = async () => {
    sound.playClick();
    if (!currentUser) return;
    if (myAcceptedChannels.length === 0) {
      showNotice('warn', '小窗模式需要在对应频道【接单】后才能打开，请先在频道列表点击接单！');
      return;
    }

    // If external window is already open, bring it to front
    if (externalWinRef.current && !externalWinRef.current.closed) {
      externalWinRef.current.focus();
      setIsMiniMode(true);
      return;
    }

    setMiniSoundEnabled(sound.isEnabled());

    // Calculate compact target size for N accepted channels
    const initWidth = 936;
    const initHeight = Math.min(Math.max(142 + (myAcceptedChannels.length - 1) * 58, 142), 640);

    let extWin: Window | null = null;

    // 1. Try Document Picture-in-Picture API first (Always-on-top independent floating OS window on Chrome/Edge)
    if ('documentPictureInPicture' in window && window.self === window.top) {
      try {
        extWin = await (window as any).documentPictureInPicture.requestWindow({
          width: initWidth,
          height: initHeight,
        });
      } catch {
        extWin = null;
      }
    }

    // 2. Fallback to independent standalone popup browser window (works across iframes & all desktop browsers)
    if (!extWin) {
      try {
        const availW = window.screen?.availWidth || 1440;
        const availH = window.screen?.availHeight || 900;
        const left = Math.max(40, Math.round((availW - initWidth) / 2));
        const top = Math.max(60, Math.round((availH - initHeight) / 5));
        extWin = window.open(
          '',
          'snowman_external_mini_window',
          `popup=yes,width=${initWidth},height=${initHeight},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
        );
      } catch {
        extWin = null;
      }
    }

    if (extWin && extWin.document) {
      try {
        extWin.document.title = `小窗模式 · ${bossConfig?.boss_name || '驮狼雪人'}刷新监控`;
        extWin.document.head.innerHTML = '';
        extWin.document.body.innerHTML = '';

        // Copy all stylesheets (<style> and <link rel="stylesheet">) from main document
        const copyStyles = () => {
          if (!extWin || extWin.closed) return;
          const nodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
          nodes.forEach((node) => {
            extWin!.document.head.appendChild(node.cloneNode(true));
          });
        };
        copyStyles();

        // Keep styles synced if Vite injects updates
        if (styleObserverRef.current) styleObserverRef.current.disconnect();
        const observer = new MutationObserver(() => {
          if (!extWin || extWin.closed) return;
          extWin.document.head.innerHTML = '';
          copyStyles();
        });
        observer.observe(document.head, { childList: true, subtree: true });
        styleObserverRef.current = observer;

        extWin.document.documentElement.style.backgroundColor = '#020617';
        extWin.document.documentElement.style.color = '#f1f5f9';
        extWin.document.body.style.margin = '0';
        extWin.document.body.style.padding = '0';
        extWin.document.body.style.backgroundColor = '#020617';
        extWin.document.body.style.color = '#f1f5f9';
        extWin.document.body.className = 'bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200';

        const mountNode = extWin.document.createElement('div');
        mountNode.id = 'snowman-external-mini-root';
        extWin.document.body.appendChild(mountNode);

        const handleExtClose = () => {
          if (styleObserverRef.current) {
            styleObserverRef.current.disconnect();
            styleObserverRef.current = null;
          }
          externalWinRef.current = null;
          setExternalRoot(null);
          setIsMiniMode(false);
        };

        extWin.addEventListener('pagehide', handleExtClose);
        extWin.addEventListener('beforeunload', handleExtClose);

        externalWinRef.current = extWin;
        setExternalRoot(mountNode);
        setIsMiniMode(true);
        extWin.focus();
        return;
      } catch {
        // Fallback to in-page mini mode if external document setup fails
      }
    }

    // 3. Fallback: In-page mini mode if browser blocked popup
    prevWindowSizeRef.current = {
      width: window.outerWidth,
      height: window.outerHeight,
    };
    setIsMiniMode(true);
    showNotice('info', '已进入小窗模式（若需弹出独立外置窗口，请在浏览器地址栏允许本站弹出窗口）');
  };

  // Exit PC Mini Window Mode: closes detached external window and returns to full webpage
  const handleExitMiniMode = () => {
    sound.playClick();
    closeExternalWindow();
    setIsMiniMode(false);
    if (prevWindowSizeRef.current) {
      try {
        window.resizeTo(prevWindowSizeRef.current.width, prevWindowSizeRef.current.height);
      } catch {
        // Ignore in standard multi-tab / iframe environments
      }
      prevWindowSizeRef.current = null;
    }
    try {
      window.focus();
    } catch {
      // ignore
    }
  };

  // Clean up external window on unmount
  useEffect(() => {
    return () => {
      if (styleObserverRef.current) styleObserverRef.current.disconnect();
      if (externalWinRef.current && !externalWinRef.current.closed) {
        try {
          externalWinRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const hasActiveModalInMini =
    confirmKillChannelNo !== null ||
    leaveModalChannelNo !== null ||
    historyChannelNo !== null ||
    resetConfirmChannelNo !== null;

  // Auto-adjust external window (or standalone app window) size to tightly fit accepted channels & buttons
  useEffect(() => {
    if (!isMiniMode) return;
    const timer = setTimeout(() => {
      const targetWin =
        externalWinRef.current && !externalWinRef.current.closed
          ? externalWinRef.current
          : window;
      if (!miniWindowRef.current) return;
      const rect = miniWindowRef.current.getBoundingClientRect();
      const chromeW = Math.max(16, (targetWin.outerWidth || 0) - (targetWin.innerWidth || 0));
      const chromeH = Math.max(36, (targetWin.outerHeight || 0) - (targetWin.innerHeight || 0));

      const desiredW = hasActiveModalInMini
        ? Math.max(Math.ceil(rect.width + chromeW), 680)
        : Math.ceil(rect.width + chromeW);
      const desiredH = hasActiveModalInMini
        ? Math.max(Math.ceil(rect.height + chromeH), 560)
        : Math.ceil(rect.height + chromeH);

      try {
        targetWin.resizeTo(desiredW, desiredH);
      } catch {
        // Ignore in standard multi-tab / iframe environments
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [isMiniMode, externalRoot, myAcceptedChannels.length, hasActiveModalInMini]);

  // Filter & Sort computation
  const filteredChannels = useMemo(() => {
    const list = Array.isArray(channels) ? channels : [];
    let result = [...list];

    // Status filter: 已接单频道无论在哪个状态Tab中，均保持显示并置顶高亮
    if (statusFilter !== 'all') {
      result = result.filter((c) => c && (c.status === statusFilter || (c.active_visitors && c.active_visitors.length > 0)));
    }

    // Has visitor filter
    if (hasVisitorFilter) {
      result = result.filter((c) => c && c.active_visitors && c.active_visitors.length > 0);
    }

    // Has note filter
    if (hasNoteFilter) {
      result = result.filter((c) => c && c.channel_note && c.channel_note.trim().length > 0);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => {
        if (!c) return false;
        const matchesNo = String(c.channel_no) === q || `${c.channel_no}频道`.includes(q);
        const matchesNote = c.channel_note && c.channel_note.toLowerCase().includes(q);
        const matchesTag = c.channel_tag && c.channel_tag.toLowerCase().includes(q);
        const matchesVisitor = (c.active_visitors || []).some((v) =>
          v && (
            (v.game_id && v.game_id.toLowerCase().includes(q)) ||
            (v.username && v.username.toLowerCase().includes(q))
          )
        );
        const matchesLastKill =
          (c.last_kill?.game_id && c.last_kill.game_id.toLowerCase().includes(q)) ||
          (c.last_kill?.kill_note && c.last_kill.kill_note.toLowerCase().includes(q));
        return Boolean(matchesNo || matchesNote || matchesTag || matchesVisitor || matchesLastKill);
      });
    }

    // Sorting:
    // 1. My accepted channel ALWAYS comes #1 at the absolute top row
    // 2. All other accepted channels (ordered by other players) are ALSO pinned right below
    // 3. Un-ordered channels follow according to user's selected sortOption
    result.sort((a, b) => {
      if (!a || !b) return 0;
      const aVisitors = a.active_visitors || [];
      const bVisitors = b.active_visitors || [];
      const aHasMe = currentUser
        ? aVisitors.some((v) => v && v.user_id === currentUser.id)
        : false;
      const bHasMe = currentUser
        ? bVisitors.some((v) => v && v.user_id === currentUser.id)
        : false;
      if (aHasMe && !bHasMe) return -1;
      if (!aHasMe && bHasMe) return 1;

      const aHasOther = aVisitors.length > 0;
      const bHasOther = bVisitors.length > 0;
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

  // Shared channel action modals (rendered inside the external window when popped out, or main window otherwise)
  const channelActionModalsJSX = (
    <>
      {/* Floating Notice Banner */}
      {bannerNotice && (
        <div className="fixed top-3 right-3 z-50 max-w-md animate-in slide-in-from-top-4 fade-in duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl border shadow-xl backdrop-blur-md flex items-center gap-3 text-xs font-medium ${
              bannerNotice.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
                : bannerNotice.type === 'warn'
                ? 'bg-amber-950/95 border-amber-700 text-amber-200'
                : 'bg-cyan-950/95 border-cyan-700 text-cyan-200'
            }`}
          >
            {bannerNotice.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />}
            {bannerNotice.type === 'warn' && <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />}
            {bannerNotice.type === 'info' && <Info className="w-4 h-4 shrink-0 text-cyan-400" />}
            <span>{bannerNotice.message}</span>
          </div>
        </div>
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

      {/* Leave Reason Modal (Required when a player or admin clicks 退单) */}
      {leaveModalChannelNo !== null && currentUser && (
        <LeaveReasonModal
          channelNo={leaveModalChannelNo}
          gameId={currentUser.game_id}
          loading={actionLoading}
          onConfirm={handleConfirmLeave}
          onCancel={() => setLeaveModalChannelNo(null)}
        />
      )}
    </>
  );

  // Mini Window UI (rendered inside detached external OS window when externalRoot exists, or in-page fallback)
  const miniWindowBoxJSX = currentUser ? (
    <div
      ref={miniWindowRef}
      className={`w-fit h-fit max-w-[99vw] overflow-x-auto sm:overflow-visible bg-slate-950 p-2.5 sm:p-3 transition-all duration-200 ${
        externalRoot
          ? ''
          : 'rounded-2xl border-2 border-amber-400/80 shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_25px_rgba(245,158,11,0.22)]'
      }`}
    >
      {/* Compact Mini Window Control Bar */}
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-800/90 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-sm">
            <PictureInPicture2 className="w-3.5 h-3.5" />
            <span>{externalRoot ? '独立外置小窗' : '小窗模式'}</span>
          </span>

          <span className="text-xs text-slate-300 font-medium">
            当前角色：<strong className="text-purple-300 font-bold">{currentUser.game_id}</strong>
          </span>

          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-950/80 border border-amber-700/70 text-amber-200">
            已接单频道：{myAcceptedChannels.length} 个
            {myAcceptedChannels.length > 0 && (
              <span className="ml-1 text-amber-300 font-mono">
                ({myAcceptedChannels.map((c) => `${c.channel_no}频`).join('、')})
              </span>
            )}
          </span>

          <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded tabular-nums">
            北京时间 <strong className="text-cyan-300">{formatBeijing(serverTime).split(' ')[1] || formatBeijing(serverTime)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* If currently in in-page fallback mode, offer 1-click button to pop out into external window */}
          {!externalRoot && (
            <button
              type="button"
              onClick={handleOpenMiniMode}
              title="脱离网页弹出为独立外置窗口"
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/70 text-amber-200 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>弹出独立外置窗</span>
            </button>
          )}

          {/* Quick Voice Broadcast Toggle in Mini Window */}
          <button
            type="button"
            onClick={() => {
              const next = !miniSoundEnabled;
              sound.setEnabled(next);
              setMiniSoundEnabled(next);
            }}
            title={miniSoundEnabled ? '语音播报已开启（点击静音）' : '已静音（点击开启语音播报）'}
            className={`px-2 py-1 rounded-lg border text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              miniSoundEnabled
                ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {miniSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-medium">{miniSoundEnabled ? '语音播报' : '已静音'}</span>
          </button>

          {/* Switch Button to Exit Mini Window Mode (关闭独立外置小窗并返回大网页) */}
          <button
            type="button"
            onClick={handleExitMiniMode}
            title="点击关闭小窗模式，返回完整大网页"
            className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer active:scale-95 transition-all"
          >
            <span className="inline-flex items-center w-6 h-3.5 rounded-full bg-slate-950/35 p-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white translate-x-2.5 transition-transform" />
            </span>
            <Maximize2 className="w-3.5 h-3.5" />
            <span>退出小窗模式</span>
          </button>
        </div>
      </div>

      {/* Accepted Channels Only Table */}
      {myAcceptedChannels.length === 0 ? (
        <div className="py-3 px-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-6 min-w-[520px]">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>当前账号已无接单中的频道（已完成击杀交单或已退单）</span>
          </div>
          <button
            type="button"
            onClick={handleExitMiniMode}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>返回大网页继续接单</span>
          </button>
        </div>
      ) : (
        <div className="w-fit">
          <ChannelTableHeader miniMode />
          <div className="space-y-1.5 mt-1.5 w-fit">
            {myAcceptedChannels.map((channel) => (
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
                miniMode
              />
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      className={`${
        isMiniMode && !externalRoot && currentUser
          ? 'min-h-0 bg-slate-950/95 p-2 sm:p-3 flex items-start justify-start'
          : 'min-h-screen bg-slate-950 flex flex-col'
      } text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200`}
    >
      {/* Portal for Detached External OS Mini Window */}
      {isMiniMode && externalRoot && currentUser &&
        createPortal(
          <div className="bg-slate-950 text-slate-100 w-fit h-fit relative">
            {miniWindowBoxJSX}
            {channelActionModalsJSX}
          </div>,
          externalRoot
        )}

      {/* Top Header (Hidden only when in in-page fallback Mini Mode) */}
      {!(isMiniMode && !externalRoot && currentUser) && (
        <Header
          currentUser={currentUser}
          onlineCount={onlineCount}
          wsConnected={wsConnected}
          pendingUsersCount={currentUser?.role === 'admin' ? pendingUsersCount : 0}
          myAcceptedCount={myAcceptedChannels.length}
          onOpenMiniMode={handleOpenMiniMode}
          onOpenAdmin={() => setAdminModalOpen(true)}
          onChangePassword={() => {
            setAuthModalMode('change_password');
            setAuthModalOpen(true);
          }}
          onLogout={handleLogout}
        />
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
      ) : isMiniMode && !externalRoot ? (
        /* In-page fallback Mini Window Mode when popup was blocked */
        miniWindowBoxJSX
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-6 py-4">
          {/* Detached External Mini Window Active Banner on Main Page */}
          {isMiniMode && externalRoot && (
            <div className="mb-4 bg-gradient-to-r from-amber-950/90 via-slate-900 to-cyan-950/85 border-2 border-amber-400/70 rounded-xl p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                  <PictureInPicture2 className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-amber-200">独立外置小窗正在运行中</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-slate-950">
                      已接单 {myAcceptedChannels.length} 个频道
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    您已接单的频道已脱离主网页，在独立外置小窗中实时显示。您可直接在小窗内进行标签、退单、击杀交单操作。
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => externalWinRef.current?.focus()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>唤起外置小窗</span>
                </button>
                <button
                  type="button"
                  onClick={handleExitMiniMode}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>退出小窗模式</span>
                </button>
              </div>
            </div>
          )}

          {/* Server Disconnected / Disaster Recovery Offline Banner */}
          {!wsConnected && (
            <div className="mb-4 bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/80 border border-rose-500/60 rounded-xl p-3.5 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <WifiOff className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-rose-300">服务器连接已断开 / 离线容灾保护中</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-900/60 text-rose-300 border border-rose-700">
                      自动重连中...
                    </span>
                    <span className="text-[10px] text-amber-300 bg-amber-950/80 border border-amber-800/80 px-2 py-0.5 rounded-full">
                      本地数据快照已就绪
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    当前频道的最新时间与人员数据已安全保存在浏览器本地，您可以随时直接将各频道数据导出为 Excel/CSV 表格备查！
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleExportChannels}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95 hover:shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>离线下载各频道时间表格 (.csv)</span>
                </button>
              </div>
            </div>
          )}

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

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleOpenMiniMode}
                  title={
                    myAcceptedChannels.length > 0
                      ? `当前已接单 ${myAcceptedChannels.length} 个频道，点击弹出独立外置小窗`
                      : '请先在对应频道点击【接单】后才能打开小窗模式'
                  }
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer ${
                    myAcceptedChannels.length > 0
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 border-amber-300 text-slate-950 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <PictureInPicture2 className={`w-4 h-4 ${myAcceptedChannels.length > 0 ? 'text-slate-950' : 'text-amber-400'}`} />
                  <span>小窗模式</span>
                  {myAcceptedChannels.length > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-950 text-amber-300">
                      已接 {myAcceptedChannels.length} 单
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-75 font-normal">(需先接单)</span>
                  )}
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      setLeaveReasonsAdminModalOpen(true);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-950/80 hover:bg-amber-900/80 border border-amber-700/80 text-amber-300 transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm cursor-pointer"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5 text-amber-400" />
                    <span>退单理由记录</span>
                  </button>
                )}
              </div>
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

          {/* Kill Statistics: 每日，每周，每月，每个人的击杀总数，条形图与饼状图 (所有登录用户可见) */}
          <AdminKillStatsSection
            currentUser={currentUser}
            lastUpdateTimestamp={statsLastUpdate}
          />

          {/* 1. Statistics Bar */}
          <StatsBar
            channels={channels}
            onlineCount={onlineCount}
            wsConnected={wsConnected}
            isAdmin={currentUser?.role === 'admin'}
            onOpenOnlinePlayers={() => setOnlinePlayersModalOpen(true)}
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
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-2 flex-wrap gap-2">
              <span>
                显示频道：<strong className="text-white font-mono">{filteredChannels.length}</strong> / 60
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleOpenMiniMode}
                  title={
                    myAcceptedChannels.length > 0
                      ? `当前已接单 ${myAcceptedChannels.length} 个频道，点击弹出独立外置小窗`
                      : '请先在对应频道点击【接单】后才能打开小窗模式'
                  }
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                    myAcceptedChannels.length > 0
                      ? 'bg-amber-950/85 hover:bg-amber-900/90 text-amber-200 border-amber-500/80'
                      : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <PictureInPicture2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>小窗模式{myAcceptedChannels.length > 0 ? ` (${myAcceptedChannels.length})` : ' (需先接单)'}</span>
                </button>
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setLeaveReasonsAdminModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-950/80 hover:bg-amber-900/80 text-amber-200 border border-amber-700/80 hover:border-amber-600 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                    title="查看所有频道与角色的退单理由日志及按角色名字汇总的退单次数（仅管理员可见）"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5 text-amber-400" />
                    <span>退单理由记录</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportChannels}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  title="导出当前各频道时间信息为表格（纯本地运行，即使断网或服务器宕机也可随时下载）"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>导出当前频道时间表 (.csv)</span>
                </button>
              </div>
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

      {/* Render channel action modals in main window when NOT in external window mode */}
      {!(isMiniMode && externalRoot) && channelActionModalsJSX}

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

      {/* Online Players Modal (Admin only) */}
      {onlinePlayersModalOpen && currentUser?.role === 'admin' && (
        <OnlinePlayersModal onClose={() => setOnlinePlayersModalOpen(false)} />
      )}

      {/* Leave Reasons Admin Log & Summary Modal (Admin only) */}
      {leaveReasonsAdminModalOpen && currentUser?.role === 'admin' && (
        <LeaveReasonsAdminModal onClose={() => setLeaveReasonsAdminModalOpen(false)} />
      )}
    </div>
  );
}
