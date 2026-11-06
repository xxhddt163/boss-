import React from 'react';
import { ChannelComputedView } from '../types.ts';
import { Users, Radio, Clock, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

interface StatsBarProps {
  channels: ChannelComputedView[];
  onlineCount: number;
  wsConnected: boolean;
  isAdmin?: boolean;
  onOpenOnlinePlayers?: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  channels,
  onlineCount,
  wsConnected,
  isAdmin = false,
  onOpenOnlinePlayers,
}) => {
  const list = Array.isArray(channels) ? channels : [];
  const total = list.length;
  const waiting = list.filter((c) => c && c.status === 'waiting_entry').length;
  const inSpawn = list.filter((c) => c && c.status === 'in_spawn_window').length;
  const guaranteed = list.filter((c) => c && c.status === 'guaranteed_reached').length;
  const unrecorded = list.filter((c) => c && c.status === 'unrecorded').length;
  const visitedCount = list.filter((c) => c && c.active_visitors && c.active_visitors.length > 0).length;

  return (
    <section className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 my-4 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
        {/* Total Channels */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-950/40 border border-slate-800/40">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>总频道数</span>
          </div>
          <span className="text-xl font-bold font-mono text-white tabular-nums mt-0.5">
            {total}
          </span>
        </div>

        {/* Waiting Entry */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-sky-950/20 border border-sky-800/30">
          <div className="flex items-center gap-1.5 text-xs text-sky-400">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>等待进刷</span>
          </div>
          <span className="text-xl font-bold font-mono text-sky-300 tabular-nums mt-0.5">
            {waiting}
          </span>
        </div>

        {/* In Spawn Window */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-950/20 border border-emerald-800/30">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>进入刷新时间</span>
          </div>
          <span className="text-xl font-bold font-mono text-emerald-300 tabular-nums mt-0.5">
            {inSpawn}
          </span>
        </div>

        {/* Guaranteed Reached */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-rose-950/20 border border-rose-800/30">
          <div className="flex items-center gap-1.5 text-xs text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>已到保底</span>
          </div>
          <span className="text-xl font-bold font-mono text-rose-300 tabular-nums mt-0.5">
            {guaranteed}
          </span>
        </div>

        {/* Unrecorded */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-950/40 border border-slate-800/40">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>未记录</span>
          </div>
          <span className="text-xl font-bold font-mono text-slate-400 tabular-nums mt-0.5">
            {unrecorded}
          </span>
        </div>

        {/* Channels with visitors */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-purple-950/20 border border-purple-800/30">
          <div className="flex items-center gap-1.5 text-xs text-purple-400">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>有人蹲守频道</span>
          </div>
          <span className="text-xl font-bold font-mono text-purple-300 tabular-nums mt-0.5">
            {visitedCount}
          </span>
        </div>

        {/* Online Players */}
        <div
          onClick={isAdmin ? onOpenOnlinePlayers : undefined}
          title={isAdmin ? '点击查看当前在线玩家列表（仅管理员）' : undefined}
          className={`col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
            isAdmin
              ? 'bg-slate-950/60 border-cyan-800/60 hover:border-cyan-400 hover:bg-slate-900/90 cursor-pointer shadow-sm group active:scale-95'
              : 'bg-slate-950/40 border-slate-800/40 cursor-default'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className={isAdmin ? 'group-hover:text-cyan-300 transition-colors' : ''}>在线玩家</span>
          </div>
          <span className="text-xl font-bold font-mono text-cyan-300 tabular-nums mt-0.5">
            {onlineCount} <span className="text-xs text-slate-400 font-sans font-normal">人</span>
          </span>
          {isAdmin && (
            <span className="text-[10px] text-cyan-400/80 group-hover:text-cyan-300 font-medium transition-colors mt-0.5">
              点击查看名单
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
