import React, { useState, useEffect, useMemo } from 'react';
import { LeaveReasonRecord, RoleLeaveSummary } from '../types.ts';
import { api } from '../services/api.ts';
import { formatBeijing, getBeijingParts } from '../utils/time.ts';
import { sound } from '../utils/sound.ts';
import {
  FileText,
  X,
  RefreshCw,
  Search,
  Calendar,
  Hash,
  User as UserIcon,
  Clock,
  BarChart3,
  MessageSquareWarning,
  Loader2,
  Filter,
} from 'lucide-react';

interface LeaveReasonsAdminModalProps {
  onClose: () => void;
}

type TimeRangePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

export const LeaveReasonsAdminModal: React.FC<LeaveReasonsAdminModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [records, setRecords] = useState<LeaveReasonRecord[]>([]);

  // Filters
  const [timePreset, setTimePreset] = useState<TimeRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLeaveReasons = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.getLeaveReasons();
      setRecords(Array.isArray(res.records) ? res.records : []);
    } catch (err: any) {
      setErrorMsg(err.message || '加载退单理由记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveReasons();
  }, []);

  // Filter records by time range and channel first (used for both Role Summary and Detailed Logs)
  const timeAndChannelFilteredRecords = useMemo(() => {
    const now = new Date();
    const nowParts = getBeijingParts(now);
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${nowParts.year}-${pad(nowParts.month)}-${pad(nowParts.day)}`;

    return records.filter((r) => {
      // 1. Channel filter
      if (selectedChannel !== 'all' && r.channel_no !== Number(selectedChannel)) {
        return false;
      }

      // 2. Time range filter
      const leftTimeMs = new Date(r.left_at).getTime();
      if (isNaN(leftTimeMs)) return true;

      if (timePreset === 'today') {
        const p = getBeijingParts(r.left_at);
        const rDateStr = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
        if (rDateStr !== todayStr) return false;
      } else if (timePreset === '7d') {
        if (now.getTime() - leftTimeMs > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (timePreset === '30d') {
        if (now.getTime() - leftTimeMs > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (timePreset === 'custom') {
        if (customStartDate) {
          const startMs = new Date(`${customStartDate}T00:00:00+08:00`).getTime();
          if (!isNaN(startMs) && leftTimeMs < startMs) return false;
        }
        if (customEndDate) {
          const endMs = new Date(`${customEndDate}T23:59:59+08:00`).getTime();
          if (!isNaN(endMs) && leftTimeMs > endMs) return false;
        }
      }

      return true;
    });
  }, [records, timePreset, customStartDate, customEndDate, selectedChannel]);

  // Summarize by role (game_id) based on current time & channel filter
  const roleSummaries: RoleLeaveSummary[] = useMemo(() => {
    const map = new Map<
      string,
      {
        user_id?: string;
        game_id: string;
        username: string;
        leaveCount: number;
        lastLeftAt: string;
        channelsSet: Set<number>;
      }
    >();

    for (const r of timeAndChannelFilteredRecords) {
      const key = r.game_id;
      const existing = map.get(key);
      if (existing) {
        existing.leaveCount += 1;
        existing.channelsSet.add(r.channel_no);
        if (new Date(r.left_at).getTime() > new Date(existing.lastLeftAt).getTime()) {
          existing.lastLeftAt = r.left_at;
        }
      } else {
        map.set(key, {
          user_id: r.user_id,
          game_id: r.game_id,
          username: r.username,
          leaveCount: 1,
          lastLeftAt: r.left_at,
          channelsSet: new Set([r.channel_no]),
        });
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        user_id: item.user_id,
        game_id: item.game_id,
        username: item.username,
        leaveCount: item.leaveCount,
        lastLeftAt: item.lastLeftAt,
        channels: Array.from(item.channelsSet).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.leaveCount - a.leaveCount);
  }, [timeAndChannelFilteredRecords]);

  // Final filtered logs including role selection and keyword search
  const finalLogs = useMemo(() => {
    return timeAndChannelFilteredRecords.filter((r) => {
      if (selectedRole && r.game_id !== selectedRole) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchRole = r.game_id.toLowerCase().includes(q);
        const matchUser = r.username.toLowerCase().includes(q);
        const matchReason = r.leave_reason.toLowerCase().includes(q);
        const matchCh = `${r.channel_no}`.includes(q) || `${r.channel_no}频道`.includes(q);
        return matchRole || matchUser || matchReason || matchCh;
      }
      return true;
    });
  }, [timeAndChannelFilteredRecords, selectedRole, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  退单理由日志与角色退单次数汇总
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950 border border-amber-800 text-amber-300">
                  共 {finalLogs.length} 条记录
                </span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded-full font-semibold">
                  仅管理员可见
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                按时间段、频道、角色名查询所有退单原因，并按角色名字自动汇总退单次数
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                fetchLeaveReasons();
              }}
              disabled={loading}
              title="刷新退单记录"
              className="p-2 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar: Time Range + Channel + Search */}
        <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Time Period Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>时间段:</span>
              </span>
              {(
                [
                  { id: 'all', label: '全部时间' },
                  { id: 'today', label: '今日' },
                  { id: '7d', label: '最近7天' },
                  { id: '30d', label: '最近30天' },
                  { id: 'custom', label: '自定义日期' },
                ] as { id: TimeRangePreset; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimePreset(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    timePreset === t.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Channel & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">全部频道 (1~60)</option>
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((chNo) => (
                    <option key={chNo} value={String(chNo)}>
                      {chNo} 频道
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-52 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索角色名 / 账号 / 退单理由..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Custom Date Picker Row */}
          {timePreset === 'custom' && (
            <div className="flex items-center gap-2 pt-1 text-xs animate-in fade-in">
              <span className="text-slate-400">起始日期:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
              />
              <span className="text-slate-500">至</span>
              <span className="text-slate-400">结束日期:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
              />
            </div>
          )}
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-3" />
              <p className="text-sm">正在加载退单理由与统计数据...</p>
            </div>
          ) : (
            <>
              {/* Section 1: 按角色名字汇总退单次数 */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">
                      按角色名字汇总退单次数
                    </h4>
                    <span className="text-xs text-slate-400">
                      （共 {roleSummaries.length} 名角色有退单记录，点击角色卡片可筛选下方明细）
                    </span>
                  </div>
                  {selectedRole && (
                    <button
                      type="button"
                      onClick={() => setSelectedRole('')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Filter className="w-3 h-3" />
                      <span>已筛选角色：{selectedRole}（点击显示全部）</span>
                    </button>
                  )}
                </div>

                {roleSummaries.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    当前筛选时间段/频道内暂无任何角色的退单记录
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {roleSummaries.map((role) => {
                      const isSelected = selectedRole === role.game_id;
                      return (
                        <button
                          key={role.game_id}
                          type="button"
                          onClick={() =>
                            setSelectedRole(isSelected ? '' : role.game_id)
                          }
                          className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-950/60 border-amber-400 ring-1 ring-amber-400/50 shadow-md'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="font-bold text-xs text-white truncate">
                                {role.game_id}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono truncate">
                                ({role.username})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 truncate">
                              涉及频道：{role.channels.map((c) => `${c}频`).join('、')}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="inline-flex items-baseline gap-0.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono font-black text-sm">
                              {role.leaveCount}
                              <span className="text-[10px] font-sans font-normal text-amber-200/80 ml-0.5">
                                次
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: 退单理由详细日志列表 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">
                      退单理由详细日志记录
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    按退单时间倒序排列
                  </span>
                </div>

                {finalLogs.length === 0 ? (
                  <div className="py-12 text-center bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-500">
                    <MessageSquareWarning className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">暂无符合筛选条件的退单理由记录</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {finalLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          {/* Channel Badge */}
                          <span className="px-2.5 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800/80 text-cyan-300 font-mono font-black text-xs shrink-0">
                            {log.channel_no} 频道
                          </span>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-purple-300">
                                角色：{log.game_id}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                (账号: {log.username})
                              </span>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-slate-500" />
                                退单时间：{formatBeijing(log.left_at)}
                              </span>
                              {log.joined_at && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  (接单时间：{formatBeijing(log.joined_at)})
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-1.5 inline-block max-w-full break-words">
                              <span className="text-amber-400 font-semibold">退单理由：</span>
                              {log.leave_reason}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            汇总统计：共 <strong className="text-amber-300 font-mono">{roleSummaries.length}</strong> 名角色，累计退单{' '}
            <strong className="text-amber-300 font-mono">{timeAndChannelFilteredRecords.length}</strong> 次
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors cursor-pointer"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
