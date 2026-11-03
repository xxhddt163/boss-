import React, { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { sound, requestNotificationPermission } from '../utils/sound.ts';
import { getCurrentServerTime, formatBeijing } from '../utils/time.ts';
import { Volume2, VolumeX, Bell, Shield, User as UserIcon, LogOut, KeyRound } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  onlineCount: number;
  wsConnected: boolean;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onlineCount,
  wsConnected,
  onOpenAuth,
  onOpenAdmin,
  onChangePassword,
  onLogout,
  activeTab,
  onSelectTab,
}) => {
  const [serverTimeStr, setServerTimeStr] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sound.isEnabled());
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      setServerTimeStr(formatBeijing(getCurrentServerTime()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    sound.setEnabled(next);
    setSoundEnabled(next);
  };

  const handleNotificationRequest = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      alert('已开启桌面推送通知，进刷与保底时将弹窗提醒！');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src="/src/assets/images/snowman_boss_emblem_1793630816599.jpg"
            alt="Snowman Emblem"
            className="w-8 h-8 rounded border border-cyan-500/30 object-cover shadow-sm"
          />
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('all');
            }}
            className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-cyan-400 transition-colors"
          >
            SNOWMAN TRACKER
          </a>
          <span className="hidden sm:inline text-xs font-medium text-cyan-400/80 border-l border-slate-800 pl-3">
            驮狼雪人 1-60频道
          </span>
        </div>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <button
            onClick={() => onSelectTab('all')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'all' ? 'text-cyan-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            全服频道
          </button>
          <button
            onClick={() => onSelectTab('waiting_entry')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'waiting_entry' ? 'text-sky-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            等待进刷
          </button>
          <button
            onClick={() => onSelectTab('in_spawn_window')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'in_spawn_window' ? 'text-emerald-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            正在刷新
          </button>
          <button
            onClick={() => onSelectTab('guaranteed_reached')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guaranteed_reached' ? 'text-rose-400 font-semibold' : 'hover:text-slate-200'
            }`}
          >
            已到保底
          </button>
        </nav>

        {/* Zone 3: Primary action & User session */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Server time indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-md tabular-nums">
            <span className="text-slate-400 font-sans">北京时间</span>
            <span className="text-cyan-300 font-semibold">{serverTimeStr || '--:--:--'}</span>
          </div>

          {/* Sound & Alert Toggles */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? '音效提醒已开启' : '音效提醒已静音'}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={handleNotificationRequest}
            title="开启桌面通知提醒"
            className="hidden sm:inline-flex p-2 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Admin Control if admin */}
          {currentUser && currentUser.role === 'admin' && (
            <button
              onClick={onOpenAdmin}
              className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-800/80 rounded-lg hover:bg-cyan-900/60 transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-sm"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>系统管理</span>
            </button>
          )}

          {/* User state / Auth button */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="font-semibold">{currentUser.game_id}</span>
                <span className="text-slate-400 text-[11px]">({currentUser.username})</span>
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs text-slate-200"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="font-semibold text-white">{currentUser.nickname}</p>
                    <p className="text-slate-400 text-[11px]">角色: {currentUser.role === 'admin' ? '管理员' : '普通玩家'}</p>
                    <p className="text-slate-400 text-[11px]">手机: {currentUser.phone}</p>
                  </div>
                  <button
                    onClick={onChangePassword}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>修改密码</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 text-rose-400 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>退出登录</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-sky-400 rounded-lg hover:from-cyan-300 hover:to-sky-300 transition-colors whitespace-nowrap flex items-center gap-1.5 shadow-md shadow-cyan-950/40"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>登录 / 注册</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
