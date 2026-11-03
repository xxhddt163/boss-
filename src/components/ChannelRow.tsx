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
      border: 'border-slate-800 hover:border-slate-700',
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
        return 'bg-amber-950/80 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
      case '不抢怪':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
      case '龙骑很强':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/70 shadow-[0_0_8px_rgba(168,85,247,0.15)]';
      default:
        return 'bg-slate-800/80 text-slate-400 border-slate-700';
    }
  };

  return (
    <div
      className={`w-full mb-3 rounded-xl border transition-all duration-200 ${statusStyles.border} ${statusStyles.bg} backdrop-blur-xs p-3.5 sm:p-4 shadow-sm relative ${
        tagDropdownOpen ? 'z-50 ring-1 ring-cyan-500/50' : 'z-0'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Section: Channel No, Status, Tag, Countdown */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-[280px]">
          {/* 1. Channel Number */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
              {channel.channel_no}
            </span>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              频道
            </span>
          </div>

          {/* 2. Channel Status Badge */}
          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${statusStyles.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                countdown.status === 'in_spawn_window' ? 'bg-emerald-400 animate-pulse' :
                countdown.status === 'guaranteed_reached' ? 'bg-rose-400 animate-ping' :
                countdown.status === 'waiting_entry' ? 'bg-sky-400' : 'bg-slate-500'
              }`} />
              {statusStyles.label}
            </span>
          </div>

          {/* 3. Channel Custom Tag (Issue 3: 护食, 不抢怪, 龙骑很强 - modifiable by logged-in users) */}
          <div className="relative shrink-0" ref={tagDropdownRef}>
            {currentUser ? (
              <button
                type="button"
                onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all cursor-pointer ${
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
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border ${getTagStyle(
                  channel.channel_tag
                )}`}
              >
                <TagIcon className="w-3 h-3" />
                <span>{channel.channel_tag}</span>
              </span>
            ) : null}

            {/* Tag Selection Popover with elevated z-index and click-away backdrop */}
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

          {/* 8. Live Countdown */}
          <div className="flex flex-col shrink-0 min-w-[120px]">
            <span className="text-[11px] text-slate-400 leading-tight">
              {countdown.subText}
            </span>
            <span
              className={`text-lg sm:text-xl font-bold font-mono tracking-wide tabular-nums ${statusStyles.countdownColor}`}
            >
              {countdown.text}
            </span>
          </div>
        </div>

        {/* Center Section: Kill time, Entry time, Guaranteed time, Visitors, Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 flex-1 text-xs text-slate-300">
          {/* 3. Latest Kill Time */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>最近击杀时间</span>
            </div>
            <div className="font-mono text-slate-200 tabular-nums">
              {channel.killed_at_display}
            </div>
          </div>

          {/* 4 & 5. Entry & Guaranteed times */}
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400">进刷 / 保底时间</div>
            <div className="font-mono text-slate-300 tabular-nums">
              <span className="text-sky-400">{channel.entry_at_display.split(' ')[1] || '--'}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-rose-400">{channel.guaranteed_at_display.split(' ')[1] || '--'}</span>
            </div>
          </div>

          {/* 6. Current Visitors (Game IDs) */}
          <div className="space-y-0.5 sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
              <Users className="w-3 h-3 text-purple-400" />
              <span>当前蹲守玩家</span>
            </div>
            <div className="truncate font-medium">
              {channel.active_visitors.length > 0 ? (
                <span className="text-purple-300 font-semibold" title={channel.active_visitors.map((v) => v.game_id).join('、')}>
                  {channel.active_visitors.map((v) => v.game_id).join('、')}
                </span>
              ) : (
                <span className="text-slate-400">暂无玩家接单</span>
              )}
            </div>
          </div>

          {/* 7. Channel Long-term Note & Single Kill Note */}
          <div className="space-y-0.5 sm:col-span-2 md:col-span-3 xl:col-span-1">
            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
              <FileText className="w-3 h-3 text-amber-400/80" />
              <span>频道长期备注</span>
            </div>
            <div className="truncate text-slate-300">
              {channel.channel_note ? (
                <span className="text-amber-200/90" title={channel.channel_note}>
                  {channel.channel_note}
                </span>
              ) : (
                <span className="text-slate-400">无长期备注</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: 9. Visit button, 10. Kill button, Details/History button */}
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/60 justify-end">
          {/* History / Detail button */}
          <button
            onClick={() => onOpenHistory(channel.channel_no)}
            title="查看击杀历史与手动补录"
            className="p-2 text-xs text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">记录</span>
          </button>

          {/* 9. Order / Visit Button */}
          {isVisiting ? (
            <button
              onClick={() => onLeave(channel.channel_no)}
              disabled={isActionLoading}
              className="px-3.5 py-2 text-xs font-semibold text-purple-300 bg-purple-950/80 border border-purple-700/80 hover:bg-purple-900/80 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
              title="您已接单此频道，点击退单"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>退单</span>
            </button>
          ) : (
            <button
              onClick={() => onVisit(channel.channel_no)}
              disabled={isActionLoading}
              className="px-3.5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-700/80 rounded-lg transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
              title="接单此频道以获得击杀权限"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>接单</span>
            </button>
          )}

          {/* 10. Kill Button (Opens confirmation dialog) */}
          <button
            onClick={() => onKill(channel.channel_no)}
            disabled={!isVisiting || isActionLoading}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
              isVisiting
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white cursor-pointer shadow-red-950/50'
                : 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed opacity-40'
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
