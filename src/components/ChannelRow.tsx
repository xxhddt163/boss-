import React, { useState, useRef, useEffect } from 'react';
import { ChannelComputedView, User } from '../types.ts';
import { calculateLiveCountdown } from '../utils/time.ts';
import {
  Users,
  Swords,
  LogIn,
  LogOut,
  History,
  FileText,
  Clock,
  Tag as TagIcon,
  ChevronDown,
  X,
  Hourglass,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface ChannelRowProps {
  channel: ChannelComputedView;
  currentUser: User | null;
  serverTime: Date;
  onVisit: (channelNo: number) => void;
  onLeave: (channelNo: number) => void;
  onKill: (channelNo: number) => void;
  onOpenHistory: (channelNo: number) => void;
  onUpdateTag: (channelNo: number, tag: string) => void;
  isActionLoading?: boolean;
}

const AVAILABLE_TAGS = [
  { label: '护食', color: 'bg-amber-950/80 text-amber-300 border-amber-700/80 hover:bg-amber-900/80' },
  { label: '不抢怪', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900/80' },
  { label: '龙骑很强', color: 'bg-purple-950/80 text-purple-300 border-purple-700/80 hover:bg-purple-900/80' },
];

export const ChannelRow: React.FC<ChannelRowProps> = ({
  channel,
  currentUser,
  serverTime,
  onVisit,
  onLeave,
  onKill,
  onOpenHistory,
  onUpdateTag,
  isActionLoading = false,
}) => {
  const countdown = calculateLiveCountdown(channel, serverTime);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    if (tagDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [tagDropdownOpen]);

  // Check if current user is actively visiting this channel
  const isVisiting = currentUser
    ? channel.active_visitors.some((v) => v.user_id === currentUser.id)
    : false;

  // Status visual configurations
  const statusStyles = {
    unrecorded: {
      badge: 'bg-slate-800 text-slate-400 border-slate-700',
      border: 'border-slate-800/80 hover:border-slate-700',
      bg: 'bg-slate-900/40',
      accent: 'text-slate-500',
      countdownColor: 'text-slate-400',
      label: '未记录',
    },
    waiting_entry: {
      badge: 'bg-sky-950/80 text-sky-400 border-sky-800/80',
      border: 'border-sky-900/60 hover:border-sky-700/80',
      bg: 'bg-sky-950/15',
      accent: 'text-sky-400',
      countdownColor: 'text-sky-300 font-semibold',
      label: '等待进刷',
    },
    in_spawn_window: {
      badge: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
      border: 'border-emerald-800/70 hover:border-emerald-600',
      bg: 'bg-emerald-950/20',
      accent: 'text-emerald-400',
      countdownColor: 'text-emerald-300 font-bold',
      label: '已进入刷时间',
    },
    guaranteed_reached: {
      badge: 'bg-rose-950/80 text-rose-400 border-rose-800/80 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
      border: 'border-rose-800/70 hover:border-rose-600',
      bg: 'bg-rose-950/25',
      accent: 'text-rose-400',
      countdownColor: 'text-rose-300 font-bold',
      label: '已到保底',
    },
  }[countdown.status];

  // Tag styling helper
  const getTagStyle = (tag?: string) => {
    switch (tag) {
      case '护食':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.2)]';
      case '不抢怪':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
      case '龙骑很强':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/70 shadow-[0_0_8px_rgba(168,85,247,0.2)]';
      default:
        return 'bg-slate-800/80 text-slate-400 border-slate-700';
    }
  };

  // Helper to extract HH:mm:ss only (no YYYY-MM-DD per Requirement 1)
  const getHms = (timeStr: string) => {
    if (!timeStr || timeStr === '--') return '--:--:--';
    const parts = timeStr.trim().split(' ');
    return parts.length > 1 ? parts[1] : timeStr;
  };

  const killTimeHms = getHms(channel.killed_at_display);
  const entryTimeHms = getHms(channel.entry_at_display);
  const guaranteedTimeHms = getHms(channel.guaranteed_at_display);

  return (
    <div
      className={`w-full mb-3 rounded-xl border transition-all duration-200 p-3.5 sm:p-4 shadow-sm relative ${
        tagDropdownOpen ? 'z-50 ring-1 ring-cyan-500/50' : 'z-0'
      } ${
        isVisiting
          ? 'bg-gradient-to-r from-purple-950/95 via-indigo-950/90 to-purple-950/90 border-2 border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.35)] ring-2 ring-purple-500/50'
          : channel.active_visitors.length > 0
          ? 'border-indigo-800/70 bg-indigo-950/20'
          : `${statusStyles.border} ${statusStyles.bg} backdrop-blur-xs`
      }`}
    >
      {/* 
        Sequential Order Requirement (from left to right):
        1. 频道号
        2. 标签
        3. 距离进刷时间
        4. 最近击杀时间 (时分秒)
        5. 进刷时间 (时分秒)
        6. 保底时间 (时分秒)
        7. 当前蹲守玩家
        8. 频道长期备注
        9. 记录按钮
        10. 接单按钮
        11. 击杀按钮
      */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Main Information Sequence */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 flex-1 min-w-0">
          {/* 1. 频道号 */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white tabular-nums">
              {channel.channel_no}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              频道
            </span>
            {isVisiting && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500 text-white shadow-sm animate-pulse flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>已接单</span>
              </span>
            )}
          </div>

          {/* 2. 标签 (自由修改) */}
          <div className="relative shrink-0" ref={tagDropdownRef}>
            {currentUser ? (
              <button
                type="button"
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                  channel.channel_tag
                    ? getTagStyle(channel.channel_tag)
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/80 border-dashed'
                }`}
                title="点击修改频道标签（护食 / 不抢怪 / 龙骑很强）"
              >
                <TagIcon className="w-3 h-3" />
                <span>{channel.channel_tag || '+ 标签'}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
              </button>
            ) : channel.channel_tag ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border ${getTagStyle(
                  channel.channel_tag
                )}`}
              >
                <TagIcon className="w-3 h-3" />
                <span>{channel.channel_tag}</span>
              </span>
            ) : null}

            {/* Tag Selection Popover with elevated z-index */}
            {tagDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setTagDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 z-50 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[11px] text-slate-400 font-semibold border-b border-slate-800">
                    修改 {channel.channel_no} 频道标签
                  </div>
                  {AVAILABLE_TAGS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        onUpdateTag(channel.channel_no, t.label);
                        setTagDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors border cursor-pointer ${
                        channel.channel_tag === t.label
                          ? t.color
                          : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{t.label}</span>
                      {channel.channel_tag === t.label && <span className="text-[10px]">✓</span>}
                    </button>
                  ))}
                  {channel.channel_tag && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTag(channel.channel_no, '');
                        setTagDropdownOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-1.5 transition-colors border border-transparent cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>清除标签</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 3. 距离进刷时间 (大号字体) */}
          <div className="flex flex-col shrink-0 min-w-[135px]">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Hourglass className="w-3 h-3 text-cyan-400" />
              <span>{countdown.subText || '距离进刷时间'}</span>
            </span>
            <span
              className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${statusStyles.countdownColor}`}
            >
              {countdown.text}
            </span>
          </div>

          {/* 4. 最近击杀时间 (只显示时分秒，大号字体) */}
          <div className="flex flex-col shrink-0 min-w-[105px]">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>最近击杀</span>
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-slate-100 tabular-nums">
              {killTimeHms}
            </span>
          </div>

          {/* 5. 进刷时间 (独立分开，大号字体) */}
          <div className="flex flex-col shrink-0 min-w-[105px]">
            <span className="text-[11px] text-sky-400/90 font-medium">进刷时间 (+60m)</span>
            <span className="text-base sm:text-xl font-black font-mono text-sky-400 tabular-nums">
              {entryTimeHms}
            </span>
          </div>

          {/* 6. 保底时间 (独立分开，大号字体) */}
          <div className="flex flex-col shrink-0 min-w-[105px]">
            <span className="text-[11px] text-rose-400/90 font-medium">保底时间 (+90m)</span>
            <span className="text-base sm:text-xl font-black font-mono text-rose-400 tabular-nums">
              {guaranteedTimeHms}
            </span>
          </div>

          {/* 7. 当前蹲守玩家 (大号加粗字体) */}
          <div className="flex flex-col shrink-0 min-w-[120px] max-w-[190px]">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Users className="w-3 h-3 text-purple-400" />
              <span>当前蹲守玩家</span>
            </span>
            <div className="truncate text-sm sm:text-base font-bold">
              {channel.active_visitors.length > 0 ? (
                <span
                  className="text-purple-300 font-extrabold"
                  title={channel.active_visitors.map((v) => v.game_id).join('、')}
                >
                  {channel.active_visitors.map((v) => v.game_id).join('、')}
                </span>
              ) : (
                <span className="text-slate-500 font-normal text-xs">暂无玩家接单</span>
              )}
            </div>
          </div>

          {/* 8. 频道长期备注 */}
          <div className="flex flex-col shrink-0 flex-1 min-w-[120px] max-w-[220px]">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <FileText className="w-3 h-3 text-amber-400/80" />
              <span>频道长期备注</span>
            </span>
            <div className="truncate text-xs sm:text-sm font-medium">
              {channel.channel_note ? (
                <span className="text-amber-200/90" title={channel.channel_note}>
                  {channel.channel_note}
                </span>
              ) : (
                <span className="text-slate-500 text-xs font-normal">无备注</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Sequence: 9. 记录按钮 - 10. 接单按钮 - 11. 击杀按钮 */}
        <div className="flex items-center gap-2.5 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-800/80 justify-end">
          {/* 9. 记录按钮 */}
          <button
            onClick={() => onOpenHistory(channel.channel_no)}
            title="查看击杀历史与手动补录"
            className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-950/70 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>记录</span>
          </button>

          {/* 10. 接单按钮 */}
          {isVisiting ? (
            <button
              onClick={() => onLeave(channel.channel_no)}
              disabled={isActionLoading}
              className="px-4 py-2 text-xs font-bold text-purple-200 bg-purple-900/90 hover:bg-purple-800 border border-purple-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title="您已接单此频道，点击退单"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>退单</span>
            </button>
          ) : (
            <button
              onClick={() => onVisit(channel.channel_no)}
              disabled={isActionLoading}
              className="px-4 py-2 text-xs font-bold text-cyan-200 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-600 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95 shadow-md cursor-pointer"
              title="接单此频道以获得击杀权限并自动登记游戏ID"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>接单</span>
            </button>
          )}

          {/* 11. 击杀按钮 */}
          <button
            onClick={() => onKill(channel.channel_no)}
            disabled={!isVisiting || isActionLoading}
            className={`px-5 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
              isVisiting
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white cursor-pointer shadow-red-950/50'
                : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-40'
            }`}
            title={
              isVisiting
                ? '点击弹出击杀确认窗口（将自动完成本次接单并更新进刷/保底）'
                : '仅限当前已接单本频道的玩家点击（请先点击“接单”锁定频道）'
            }
          >
            <Swords className="w-3.5 h-3.5" />
            <span>击杀</span>
          </button>
        </div>
      </div>
    </div>
  );
};
