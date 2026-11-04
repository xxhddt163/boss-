import React, { useState, useRef, useEffect } from 'react';
import { ChannelComputedView, User } from '../types.ts';
import { calculateLiveCountdown } from '../utils/time.ts';
import {
  Swords,
  LogIn,
  LogOut,
  History,
  RotateCcw,
  Tag as TagIcon,
  ChevronDown,
  X,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface ChannelRowProps {
  channel: ChannelComputedView;
  currentUser: User | null;
  serverTime: Date;
  onVisit: (channelNo: number) => void;
  onLeave: (channelNo: number) => void;
  onKill: (channelNo: number) => void;
  onOpenHistory: (channelNo: number) => void;
  onReset?: (channelNo: number) => void;
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
  onReset,
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
  const isMyVisiting = currentUser
    ? channel.active_visitors.some((v) => v.user_id === currentUser.id)
    : false;

  // Check if any player has accepted an order on this channel
  const hasVisitors = channel.active_visitors.length > 0;

  // Status visual configurations
  const statusStyles = {
    unrecorded: {
      border: 'border-slate-800/80 hover:border-slate-700',
      bg: 'bg-slate-900/40',
      countdownColor: 'text-slate-400',
      statusDot: 'bg-slate-500',
      label: '未记录',
    },
    waiting_entry: {
      border: 'border-sky-900/60 hover:border-sky-700/80',
      bg: 'bg-sky-950/15',
      countdownColor: 'text-sky-300 font-semibold',
      statusDot: 'bg-sky-400',
      label: '等待进刷',
    },
    in_spawn_window: {
      border: 'border-emerald-800/70 hover:border-emerald-600',
      bg: 'bg-emerald-950/20',
      countdownColor: 'text-emerald-300 font-bold',
      statusDot: 'bg-emerald-400 animate-pulse',
      label: '已进刷',
    },
    guaranteed_reached: {
      border: 'border-rose-800/70 hover:border-rose-600',
      bg: 'bg-rose-950/25',
      countdownColor: 'text-rose-300 font-bold',
      statusDot: 'bg-rose-400 animate-ping',
      label: '已保底',
    },
  }[countdown.status];

  // Tag styling helper
  const getTagStyle = (tag?: string) => {
    switch (tag) {
      case '护食':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.2)]';
      case '不抢怪':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70 shadow-[0_0_8px_rgba(168,85,247,0.2)]';
      case '龙骑很强':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/70 shadow-[0_0_8px_rgba(168,85,247,0.2)]';
      default:
        return 'bg-slate-800/80 text-slate-400 border-slate-700';
    }
  };

  // Helper to extract HH:mm:ss only (no YYYY-MM-DD)
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
      className={`w-full mb-2 rounded-xl border transition-all duration-200 px-2.5 sm:px-3.5 py-2 shadow-sm relative min-w-[860px] ${
        tagDropdownOpen ? 'z-50 ring-1 ring-cyan-500/50' : 'z-0'
      } ${
        isMyVisiting || hasVisitors
          ? 'bg-gradient-to-r from-amber-950/95 via-yellow-950/90 to-amber-900/85 border-2 border-amber-400 shadow-[0_0_28px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/60'
          : `${statusStyles.border} ${statusStyles.bg} backdrop-blur-xs`
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* 1. 频道号 (Column w-16 sm:w-20) */}
        <div className="w-16 sm:w-20 shrink-0 flex items-center gap-1">
          <span
            className={`text-lg sm:text-xl font-black font-mono tracking-tight tabular-nums ${
              isMyVisiting || hasVisitors
                ? 'text-amber-300'
                : 'text-white'
            }`}
          >
            {channel.channel_no}
          </span>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">
              频道
            </span>
            {isMyVisiting ? (
              <span className="mt-0.5 px-1 py-0.5 rounded text-[9px] font-black bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md flex items-center gap-0.5 whitespace-nowrap animate-pulse">
                <Sparkles className="w-2.5 h-2.5 shrink-0" />
                <span>我的</span>
              </span>
            ) : hasVisitors ? (
              <span className="mt-0.5 px-1 py-0.5 rounded text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md flex items-center gap-0.5 whitespace-nowrap">
                <UserCheck className="w-2.5 h-2.5 shrink-0" />
                <span>接单</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* 2. 标签 (Column w-16 sm:w-20) */}
        <div className="w-16 sm:w-20 shrink-0 relative" ref={tagDropdownRef}>
          {currentUser ? (
            <button
              type="button"
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              className={`inline-flex items-center gap-1 px-1.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                channel.channel_tag
                  ? getTagStyle(channel.channel_tag)
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/80 border-dashed'
              }`}
              title="点击修改频道标签（护食 / 不抢怪 / 龙骑很强）"
            >
              <TagIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{channel.channel_tag || '+ 标签'}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5 shrink-0" />
            </button>
          ) : channel.channel_tag ? (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-1 text-xs font-semibold rounded-md border ${getTagStyle(
                channel.channel_tag
              )}`}
            >
              <TagIcon className="w-3 h-3 shrink-0" />
              <span>{channel.channel_tag}</span>
            </span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}

          {/* Tag Selection Popover with elevated z-index */}
          {tagDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/20"
                onClick={() => setTagDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-2 z-50 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] text-slate-400 font-semibold border-b border-slate-800">
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
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors border cursor-pointer ${
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
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-1.5 transition-colors border border-transparent cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>清除标签</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* 3. 距离进刷时间 (Column w-30 sm:w-34) - 字体稍微改大 */}
        <div className="w-30 sm:w-34 shrink-0 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusStyles.statusDot}`} />
          <div className="flex flex-col">
            <span
              className={`text-base sm:text-lg font-black font-mono tracking-tight tabular-nums ${statusStyles.countdownColor}`}
            >
              {countdown.text}
            </span>
            <span className="text-[10px] text-slate-400 font-medium leading-tight">
              {countdown.subText || statusStyles.label}
            </span>
          </div>
        </div>

        {/* 4. 最近击杀时间 (Column w-22 sm:w-26: Only HH:mm:ss) - 字体稍微改大 */}
        <div className="w-22 sm:w-26 shrink-0">
          <span className="text-base sm:text-lg font-black font-mono text-slate-100 tabular-nums">
            {killTimeHms}
          </span>
        </div>

        {/* 5. 进刷时间 (Column w-22 sm:w-26: Only HH:mm:ss) - 字体稍微改大 */}
        <div className="w-22 sm:w-26 shrink-0">
          <span className="text-base sm:text-lg font-black font-mono text-rose-400 tabular-nums">
            {entryTimeHms}
          </span>
        </div>

        {/* 6. 保底时间 (Column w-22 sm:w-26: Only HH:mm:ss) - 字体稍微改大 */}
        <div className="w-22 sm:w-26 shrink-0">
          <span className="text-base sm:text-lg font-black font-mono text-sky-400 tabular-nums">
            {guaranteedTimeHms}
          </span>
        </div>

        {/* 7. 当前蹲守玩家 (Column w-20 sm:w-24) */}
        <div className="w-20 sm:w-24 shrink-0 truncate">
          {channel.active_visitors.length > 0 ? (
            <span
              className={`text-xs font-black ${
                isMyVisiting || hasVisitors ? 'text-amber-200' : 'text-purple-300'
              }`}
              title={channel.active_visitors.map((v) => v.game_id).join('、')}
            >
              {channel.active_visitors.map((v) => v.game_id).join('、')}
            </span>
          ) : (
            <span className="text-slate-600 font-normal text-xs">—</span>
          )}
        </div>

        {/* 8. 频道长期备注 (Column flex-1 min-w-[50px]) - 普通用户可点击修改或添加 */}
        <div className="flex-1 min-w-[50px] truncate">
          <button
            type="button"
            onClick={() => onOpenHistory(channel.channel_no)}
            className="text-left w-full truncate cursor-pointer group"
            title={channel.channel_note ? `${channel.channel_note}（点击修改长期备注）` : '点击添加频道长期备注'}
          >
            {channel.channel_note ? (
              <span className="text-xs font-medium text-amber-200/90 group-hover:text-amber-100 group-hover:underline">
                {channel.channel_note}
              </span>
            ) : (
              <span className="text-slate-600 text-xs group-hover:text-slate-400">
                {currentUser ? '+ 备注' : '—'}
              </span>
            )}
          </button>
        </div>

        {/* 9. 操作区 (Column w-48 sm:w-56 text-right) - 永远清晰呈现在最右侧 */}
        <div className="w-48 sm:w-56 shrink-0 flex items-center justify-end gap-1 sm:gap-1.5">
          {/* 记录按钮 */}
          <button
            onClick={() => onOpenHistory(channel.channel_no)}
            title="查看击杀历史与手动调整"
            className="px-2 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            <span>记录</span>
          </button>

          {/* 管理员专属重置按钮：仅管理员可见，按下后清空初始化所有时间信息 */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onReset?.(channel.channel_no)}
              disabled={isActionLoading}
              title="【管理员特权】重置此频道的所有时间信息为空"
              className="px-2 py-1 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-950/80 hover:bg-amber-900/90 border border-amber-600/80 rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer shrink-0 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>重置</span>
            </button>
          )}

          {/* 接单 / 退单按钮 */}
          {isMyVisiting ? (
            <button
              onClick={() => onLeave(channel.channel_no)}
              disabled={isActionLoading}
              className="px-2.5 py-1 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 border border-amber-300 rounded-lg transition-all flex items-center gap-1 shadow-md active:scale-95 cursor-pointer shrink-0"
              title="您已接单此频道，点击退单"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>退单</span>
            </button>
          ) : (
            <button
              onClick={() => onVisit(channel.channel_no)}
              disabled={isActionLoading}
              className="px-2.5 py-1 text-xs font-bold text-cyan-200 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-600 rounded-lg transition-colors flex items-center gap-1 active:scale-95 shadow-md cursor-pointer shrink-0"
              title="接单此频道以获得击杀权限并自动登记游戏ID"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>接单</span>
            </button>
          )}

          {/* 击杀按钮 */}
          <button
            onClick={() => onKill(channel.channel_no)}
            disabled={!isMyVisiting || isActionLoading}
            className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1 shadow-md active:scale-95 shrink-0 ${
              isMyVisiting
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white cursor-pointer shadow-red-950/50'
                : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
            }`}
            title={
              isMyVisiting
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
