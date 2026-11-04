import React, { useState, useEffect } from 'react';
import emblemImg from '../assets/images/snowman_boss_emblem_1793630816599.jpg';
import { User } from '../types.ts';
import { sound, requestNotificationPermission } from '../utils/sound.ts';
import { getCurrentServerTime, formatBeijing } from '../utils/time.ts';
import { Volume2, VolumeX, Bell, Shield, LogOut, KeyRound } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  onlineCount: number;
  wsConnected: boolean;
  onOpenAdmin: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onlineCount,
  wsConnected,
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
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Logo & Title */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={emblemImg}
            alt="Snowman Emblem"
            className="w-8 h-8 rounded border border-cyan-500/30 object-cover shadow-sm bg-slate-900"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/emblem.jpg';
            }}
          />
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab?.('all');
            }}
            className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-cyan-400 transition-colors"
          >
            SNOWMAN TRACKER
          </a>
          <span className="hidden sm:inline text-xs font-medium text-cyan-400/80 border-l border-slate-800 pl-3">
            驮狼雪人 1-60频道
          </span>
        </div>

        {/* Zone 3: Actions & User session */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Server time indicator */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-md tabular-nums">
            <span className="text-slate-400 font-sans">北京时间</span>
            <span className="text-cyan-300 font-semibold">{serverTimeStr || '--:--:--'}</span>
          </div>

          {/* Sound & Female Voice Broadcast Toggle */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? '女声语音播报与音效已开启（点击静音）' : '语音与音效已静音（点击开启）'}
            className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-800'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline font-medium text-[11px]">
              {soundEnabled ? '女声播报' : '已静音'}
            </span>
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

          {/* User state (No login/register button when logged in, per requirement 1) */}
          {currentUser && (
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
          )}
        </div>
      </div>
    </header>
  );
};
