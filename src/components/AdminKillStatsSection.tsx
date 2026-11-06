import React, { useState, useEffect, useMemo } from 'react';
import { User, KillStatsData, DailyKillStat, WeeklyKillStat, MonthlyKillStat, RoleKillShare, MemberKillStat } from '../types.ts';
import { api } from '../services/api.ts';
import {
  BarChart3,
  PieChart as PieIcon,
  Users,
  Calendar,
  CalendarDays,
  CalendarRange,
  Crown,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface AdminKillStatsSectionProps {
  currentUser: User | null;
  /** When channels update (e.g. via WebSocket), notify stats to refresh if active */
  lastUpdateTimestamp?: number;
}

type TimeScaleMode = 'daily' | 'weekly' | 'monthly';

export const AdminKillStatsSection: React.FC<AdminKillStatsSectionProps> = ({
  currentUser,
  lastUpdateTimestamp,
}) => {
  // Strict admin guard: do not render anything if not admin
  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  const [stats, setStats] = useState<KillStatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [timeScale, setTimeScale] = useState<TimeScaleMode>('daily');
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const [hoveredChannelSliceIndex, setHoveredChannelSliceIndex] = useState<number | null>(null);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState<string>('');

  const fetchStats = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const data = await api.getKillStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load admin kill stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentUser]);

  // Refresh when external kills or websocket state changes
  useEffect(() => {
    if (lastUpdateTimestamp) {
      fetchStats();
    }
  }, [lastUpdateTimestamp]);

  // Bar chart active data source (with per-period roleShare and channelShare)
  const barData = useMemo(() => {
    if (!stats) return [];
    if (timeScale === 'daily') {
      return stats.dailyStats.map((d) => ({
        key: d.date,
        label: d.label,
        subLabel: d.date,
        periodTitle: d.isToday ? `今日 (${d.date})` : d.date,
        shortTitle: d.isToday ? '今日' : d.label,
        count: d.count,
        isCurrent: !!d.isToday,
        roleShare: d.roleShare || [],
        channelShare: d.channelShare || [],
      }));
    } else if (timeScale === 'weekly') {
      return stats.weeklyStats.map((w) => ({
        key: w.week,
        label: w.label,
        subLabel: w.dateRange,
        periodTitle: w.isCurrentWeek ? `本周 · ${w.label} (${w.dateRange})` : `${w.label} (${w.dateRange})`,
        shortTitle: w.isCurrentWeek ? '本周' : w.label,
        count: w.count,
        isCurrent: !!w.isCurrentWeek,
        roleShare: w.roleShare || [],
        channelShare: w.channelShare || [],
      }));
    } else {
      return stats.monthlyStats.map((m) => ({
        key: m.month,
        label: m.label,
        subLabel: m.yearMonth,
        periodTitle: m.isCurrentMonth ? `本月 (${m.yearMonth})` : m.yearMonth,
        shortTitle: m.isCurrentMonth ? '本月' : m.label,
        count: m.count,
        isCurrent: !!m.isCurrentMonth,
        roleShare: m.roleShare || [],
        channelShare: m.channelShare || [],
      }));
    }
  }, [stats, timeScale]);

  // Active period item driving the Pie Charts (defaults to current period: Today / This Week / This Month)
  const activePeriodItem = useMemo(() => {
    if (barData.length === 0) return null;
    if (selectedPeriodKey) {
      const found = barData.find((b) => b.key === selectedPeriodKey);
      if (found) return found;
    }
    return barData.find((b) => b.isCurrent) || barData[barData.length - 1];
  }, [barData, selectedPeriodKey]);

  const activeRoleShare = activePeriodItem?.roleShare || [];
  const activeChannelShare = activePeriodItem?.channelShare || [];
  const activePeriodKills = activePeriodItem?.count || 0;

  // Bar chart scaling
  const maxBarCount = useMemo(() => {
    const counts = (barData || []).map((b) => b?.count || 0);
    const maxVal = counts.length > 0 ? Math.max(...counts, 0) : 0;
    return Math.max(maxVal, 6);
  }, [barData]);

  // Helper to build SVG donut slices for any share array
  const buildDonutSlices = <T extends { count: number; color: string }>(items: T[], total: number) => {
    if (!items || items.length === 0 || total === 0) return [];
    let currentAngle = -Math.PI / 2; // start from top (12 o'clock)
    return items.map((item) => {
      const rawAngle = (item.count / total) * 2 * Math.PI;
      const sliceAngle = Math.min(rawAngle, 2 * Math.PI - 0.0005);
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle += rawAngle;

      const rOuter = 95;
      const rInner = 56;
      const cx = 130;
      const cy = 130;

      const x1 = cx + rOuter * Math.cos(startAngle);
      const y1 = cy + rOuter * Math.sin(startAngle);
      const x2 = cx + rOuter * Math.cos(endAngle);
      const y2 = cy + rOuter * Math.sin(endAngle);

      const x3 = cx + rInner * Math.cos(endAngle);
      const y3 = cy + rInner * Math.sin(endAngle);
      const x4 = cx + rInner * Math.cos(startAngle);
      const y4 = cy + rInner * Math.sin(startAngle);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z',
      ].join(' ');

      return {
        item,
        path,
        color: item.color,
      };
    });
  };

  // Role Pie chart computation based on activePeriodItem
  const pieSlices = useMemo(() => {
    return buildDonutSlices(activeRoleShare, activePeriodKills);
  }, [activeRoleShare, activePeriodKills]);

  // Channel Pie chart computation based on activePeriodItem
  const channelPieSlices = useMemo(() => {
    return buildDonutSlices(activeChannelShare, activePeriodKills);
  }, [activeChannelShare, activePeriodKills]);

  // Filtered member list for ranking table
  const filteredMembers = useMemo(() => {
    if (!stats) return [];
    if (!memberSearch.trim()) return stats.memberStats;
    const q = memberSearch.trim().toLowerCase();
    return stats.memberStats.filter(
      (m) =>
        m.game_id.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q)
    );
  }, [stats, memberSearch]);

  return (
    <section className="mb-4 rounded-2xl border border-cyan-800/40 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 shadow-xl backdrop-blur-md overflow-hidden transition-all">
      {/* 1. Header Toolbar */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                击杀数据统计监控
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  管理员专享
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              全服击杀汇总 · 实时统计每日、每周、每月及每位角色的击杀总数与占比
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
            title="刷新统计数据"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Collapse/Expand toggle */}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="text-[11px]">{collapsed ? '展开看板' : '收起看板'}</span>
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metrics Cards (Always visible, even when semi-collapsed) */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Card 1: 今日击杀总数 */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-cyan-900/30 hover:border-cyan-700/50 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                今日击杀总数
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                日
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-300 tabular-nums">
                {stats?.todayKills ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                昨日: <strong className="text-slate-400">{stats?.yesterdayKills ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Card 2: 本周击杀总数 */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-emerald-900/30 hover:border-emerald-700/50 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                本周击杀总数
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                周
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300 tabular-nums">
                {stats?.thisWeekKills ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                上周: <strong className="text-slate-400">{stats?.lastWeekKills ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Card 3: 本月击杀总数 */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-violet-900/30 hover:border-violet-700/50 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-violet-400" />
                本月击杀总数
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-950/80 text-violet-300 border border-violet-800/50">
                月
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-violet-300 tabular-nums">
                {stats?.thisMonthKills ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                上月: <strong className="text-slate-400">{stats?.lastMonthKills ?? 0}</strong>
              </span>
            </div>
          </div>

          {/* Card 4: 参与击杀成员总数 */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-amber-900/30 hover:border-amber-700/50 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                参与击杀角色数
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800/50">
                人
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300 tabular-nums">
                {stats?.uniqueKillersCount ?? 0}
              </span>
              <span className="text-[11px] text-slate-500">
                共记录角色
              </span>
            </div>
          </div>

          {/* Card 5: 全服历史击杀总量 */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-3 sm:p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-rose-400" />
                历史有效击杀总计
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                全
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tabular-nums">
                {stats?.totalKills ?? 0}
              </span>
              <span className="text-[11px] text-slate-500">
                条有效记录
              </span>
            </div>
          </div>
        </div>

        {/* 3. Charts Area (Collapsible) */}
        {!collapsed && (
          <div className="mt-5 space-y-5 animate-in fade-in duration-200">
            {/* Visual Charts: Bar Chart (Time Kills) & Pie Chart (Role Share) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column (7 cols): Bar Chart of Kills over Time */}
              <div className="lg:col-span-7 rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 sm:p-5 flex flex-col justify-between shadow-inner">
                {/* Bar Chart Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                        时间维度击杀条形图
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {timeScale === 'daily'
                          ? '每日击杀趋势（近14天 · 点击柱条可联动右侧饼图）'
                          : timeScale === 'weekly'
                          ? '每周击杀趋势（近8周 · 点击柱条可联动右侧饼图）'
                          : '每月击杀汇总（近6个月 · 点击柱条可联动右侧饼图）'}
                      </p>
                    </div>
                  </div>

                  {/* Switch between Daily / Weekly / Monthly */}
                  <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                    <button
                      onClick={() => {
                        setTimeScale('daily');
                        setSelectedPeriodKey(null);
                        setHoveredSliceIndex(null);
                        setHoveredChannelSliceIndex(null);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        timeScale === 'daily'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      按日
                    </button>
                    <button
                      onClick={() => {
                        setTimeScale('weekly');
                        setSelectedPeriodKey(null);
                        setHoveredSliceIndex(null);
                        setHoveredChannelSliceIndex(null);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        timeScale === 'weekly'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      按周
                    </button>
                    <button
                      onClick={() => {
                        setTimeScale('monthly');
                        setSelectedPeriodKey(null);
                        setHoveredSliceIndex(null);
                        setHoveredChannelSliceIndex(null);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        timeScale === 'monthly'
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      按月
                    </button>
                  </div>
                </div>

                {/* SVG Bar Chart */}
                <div className="relative w-full h-56 select-none">
                  {barData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      暂无统计数据
                    </div>
                  ) : (
                    <svg className="w-full h-full" viewBox="0 0 600 220" preserveAspectRatio="none">
                      <defs>
                        {/* Bar Gradient Standard */}
                        <linearGradient id="barGradientCyan" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#0891b2" stopOpacity="0.4" />
                        </linearGradient>
                        {/* Bar Gradient Highlight */}
                        <linearGradient id="barGradientHighlight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
                          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.7" />
                        </linearGradient>
                        {/* Bar Gradient Selected */}
                        <linearGradient id="barGradientSelected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                          <stop offset="100%" stopColor="#d97706" stopOpacity="0.75" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Gridlines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y = 175 - pct * 145;
                        const tickValue = Math.round(maxBarCount * pct);
                        return (
                          <g key={idx}>
                            <line
                              x1="35"
                              y1={y}
                              x2="590"
                              y2={y}
                              stroke="#334155"
                              strokeDasharray="3 3"
                              strokeWidth="0.7"
                              opacity={0.6}
                            />
                            <text
                              x="28"
                              y={y + 3}
                              textAnchor="end"
                              fill="#64748b"
                              fontSize="10"
                              fontFamily="monospace"
                            >
                              {tickValue}
                            </text>
                          </g>
                        );
                      })}

                      {/* Bars */}
                      {barData.map((item, idx) => {
                        const totalBars = barData.length;
                        const availableWidth = 550;
                        const slotWidth = availableWidth / totalBars;
                        const barWidth = Math.min(Math.max(slotWidth * 0.65, 12), 36);
                        const x = 40 + idx * slotWidth + (slotWidth - barWidth) / 2;
                        const barHeight = maxBarCount > 0 ? (item.count / maxBarCount) * 145 : 0;
                        const y = 175 - barHeight;
                        const isHovered = hoveredBarIndex === idx;
                        const isSelected = activePeriodItem?.key === item.key;

                        return (
                          <g
                            key={item.key}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredBarIndex(idx)}
                            onMouseLeave={() => setHoveredBarIndex(null)}
                            onClick={() => {
                              setSelectedPeriodKey(item.key);
                              setHoveredSliceIndex(null);
                              setHoveredChannelSliceIndex(null);
                            }}
                          >
                            {/* Hitbox area for smooth hovering & clicking */}
                            <rect
                              x={40 + idx * slotWidth}
                              y="10"
                              width={slotWidth}
                              height="205"
                              fill="transparent"
                            />

                            {/* Background slot subtle glow on hover or selection */}
                            {(isHovered || isSelected) && (
                              <rect
                                x={40 + idx * slotWidth + 2}
                                y="18"
                                width={slotWidth - 4}
                                height="160"
                                rx="4"
                                fill={isSelected ? '#f59e0b' : '#06b6d4'}
                                opacity={isSelected ? 0.12 : 0.08}
                              />
                            )}

                            {/* Base baseline bar (empty placeholder for zero counts) */}
                            <rect
                              x={x}
                              y="173"
                              width={barWidth}
                              height="2"
                              rx="1"
                              fill={isSelected ? '#f59e0b' : '#334155'}
                            />

                            {/* Value Bar */}
                            {barHeight > 0 && (
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                rx="4"
                                fill={
                                  isSelected
                                    ? 'url(#barGradientSelected)'
                                    : item.isCurrent || isHovered
                                    ? 'url(#barGradientHighlight)'
                                    : 'url(#barGradientCyan)'
                                }
                                stroke={
                                  isSelected
                                    ? '#fde68a'
                                    : item.isCurrent || isHovered
                                    ? '#7dd3fc'
                                    : '#22d3ee'
                                }
                                strokeWidth={isSelected || isHovered ? 1.5 : 0.8}
                                className="transition-all duration-200"
                              />
                            )}

                            {/* Bar Top Value Label */}
                            {item.count > 0 && (
                              <text
                                x={x + barWidth / 2}
                                y={Math.max(y - 5, 20)}
                                textAnchor="middle"
                                fill={
                                  isSelected
                                    ? '#fbbf24'
                                    : item.isCurrent || isHovered
                                    ? '#38bdf8'
                                    : '#94a3b8'
                                }
                                fontSize="11"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {item.count}
                              </text>
                            )}

                            {/* X-axis Label */}
                            <text
                              x={x + barWidth / 2}
                              y="196"
                              textAnchor="middle"
                              fill={
                                isSelected
                                  ? '#fbbf24'
                                  : item.isCurrent
                                  ? '#38bdf8'
                                  : isHovered
                                  ? '#e2e8f0'
                                  : '#64748b'
                              }
                              fontSize={totalBars > 10 ? '9' : '10'}
                              fontWeight={isSelected || item.isCurrent ? 'bold' : 'normal'}
                            >
                              {item.label}
                            </text>

                            {/* Selected / Current Period Indicator */}
                            {isSelected ? (
                              <circle
                                cx={x + barWidth / 2}
                                cy="206"
                                r="3"
                                fill="#fbbf24"
                              />
                            ) : item.isCurrent ? (
                              <circle
                                cx={x + barWidth / 2}
                                cy="206"
                                r="2.5"
                                fill="#38bdf8"
                              />
                            ) : null}
                          </g>
                        );
                      })}
                    </svg>
                  )}

                  {/* Floating Tooltip on Hover */}
                  {hoveredBarIndex !== null && barData[hoveredBarIndex] && (
                    <div className="absolute top-2 right-4 pointer-events-none px-3 py-1.5 rounded-lg bg-slate-900/95 border border-cyan-500/50 shadow-xl backdrop-blur-md text-xs animate-in fade-in duration-150">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>{barData[hoveredBarIndex].subLabel}</span>
                        {barData[hoveredBarIndex].isCurrent && (
                          <span className="text-[10px] text-cyan-300 bg-cyan-950 px-1 rounded">当前</span>
                        )}
                      </div>
                      <div className="text-slate-300 mt-0.5">
                        击杀总数：
                        <strong className="text-cyan-300 font-mono text-sm ml-1">
                          {barData[hoveredBarIndex].count}
                        </strong> 次
                        <span className="text-[10px] text-amber-300 ml-2">(点击查看饼图占比)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer notes */}
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>总计周期峰值: {maxBarCount} 次</span>
                  <span>
                    当前选中: <strong className="text-amber-300">{activePeriodItem?.periodTitle || '--'}</strong>
                  </span>
                </div>
              </div>

              {/* Right Column (5 cols): Stacked Role Kill Share & Channel Kill Share Pie Charts */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                {/* 1. Role Kill Share Pie Chart */}
                <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 sm:p-5 flex flex-col justify-between shadow-inner">
                  {/* Pie Chart Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                            角色击杀数占比饼状图
                          </h3>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {activePeriodItem?.periodTitle || '当前周期'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          当前展示 <strong className="text-slate-200">{activePeriodItem?.periodTitle || '所选周期'}</strong> 内各角色击杀占比
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-[11px] font-mono text-slate-400">
                        共 <strong className="text-white">{activeRoleShare.length}</strong> 个角色
                      </span>
                      {activePeriodItem && !activePeriodItem.isCurrent && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPeriodKey(null);
                            setHoveredSliceIndex(null);
                            setHoveredChannelSliceIndex(null);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                        >
                          切回{timeScale === 'daily' ? '今日' : timeScale === 'weekly' ? '本周' : '本月'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Donut Chart Visual & Interactive Center */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                    <div className="relative w-56 h-56 shrink-0 flex items-center justify-center">
                      {activePeriodKills === 0 ? (
                        <div className="w-48 h-48 rounded-full border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-4">
                          <Users className="w-6 h-6 text-slate-600 mb-1" />
                          <span className="text-xs font-medium text-slate-400">
                            {activePeriodItem?.shortTitle || '该周期'}暂无击杀记录
                          </span>
                          <span className="text-[10px] text-slate-600 mt-0.5">可点击左侧其他柱条查看</span>
                        </div>
                      ) : (
                        <svg className="w-56 h-56 transform -rotate-90 select-none" viewBox="0 0 260 260">
                          {pieSlices.map((slice, idx) => {
                            const isHovered = hoveredSliceIndex === idx;
                            return (
                              <path
                                key={slice.item.game_id}
                                d={slice.path}
                                fill={slice.color}
                                stroke="#020617"
                                strokeWidth={isHovered ? 3 : 1.5}
                                className="cursor-pointer transition-all duration-200"
                                opacity={hoveredSliceIndex === null || isHovered ? 1 : 0.45}
                                onMouseEnter={() => setHoveredSliceIndex(idx)}
                                onMouseLeave={() => setHoveredSliceIndex(null)}
                              />
                            );
                          })}
                        </svg>
                      )}

                      {/* Donut Center Display */}
                      {activePeriodKills > 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                          {hoveredSliceIndex !== null && activeRoleShare[hoveredSliceIndex] ? (
                            <>
                              <span className="text-[11px] font-bold text-slate-300 truncate max-w-[110px]">
                                {activeRoleShare[hoveredSliceIndex].game_id}
                              </span>
                              <span className="text-xl font-extrabold font-mono text-white mt-0.5">
                                {activeRoleShare[hoveredSliceIndex].percentage}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {activeRoleShare[hoveredSliceIndex].count} 次击杀
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] uppercase tracking-wider text-amber-300/90 font-semibold truncate max-w-[110px]">
                                {activePeriodItem?.shortTitle || '当前'}击杀量
                              </span>
                              <span className="text-2xl font-extrabold font-mono text-white mt-0.5">
                                {activePeriodKills}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {activeRoleShare.length} 位参与角色
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Legend on Right / Bottom */}
                    <div className="flex-1 w-full max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {activeRoleShare.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">该周期暂无角色数据</p>
                      ) : (
                        activeRoleShare.map((role, idx) => {
                          const isHovered = hoveredSliceIndex === idx;
                          return (
                            <div
                              key={role.game_id}
                              onMouseEnter={() => setHoveredSliceIndex(idx)}
                              onMouseLeave={() => setHoveredSliceIndex(null)}
                              className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                isHovered ? 'bg-slate-800/90 text-white' : 'hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: role.color }}
                                />
                                <span className="truncate font-medium">{role.game_id}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                <span className="text-slate-400">{role.count}次</span>
                                <span className="font-bold text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  {role.percentage}%
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Footer notes */}
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>点击左侧条形图可切换周期</span>
                    <span className="font-mono">当前合计: {activePeriodKills} 次击杀</span>
                  </div>
                </div>

                {/* 2. Channel Kill Share Pie Chart (Below Role Pie Chart) */}
                <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 sm:p-5 flex flex-col justify-between shadow-inner">
                  {/* Channel Pie Chart Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                            频道击杀数占比饼状图
                          </h3>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            {activePeriodItem?.periodTitle || '当前周期'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          当前展示 <strong className="text-slate-200">{activePeriodItem?.periodTitle || '所选周期'}</strong> 内各频道击杀占比
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="text-[11px] font-mono text-slate-400">
                        共 <strong className="text-white">{activeChannelShare.length}</strong> 个频道
                      </span>
                    </div>
                  </div>

                  {/* Donut Chart Visual & Interactive Center */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                    <div className="relative w-56 h-56 shrink-0 flex items-center justify-center">
                      {activePeriodKills === 0 ? (
                        <div className="w-48 h-48 rounded-full border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-4">
                          <PieIcon className="w-6 h-6 text-slate-600 mb-1" />
                          <span className="text-xs font-medium text-slate-400">
                            {activePeriodItem?.shortTitle || '该周期'}暂无频道击杀
                          </span>
                          <span className="text-[10px] text-slate-600 mt-0.5">可点击左侧其他柱条查看</span>
                        </div>
                      ) : (
                        <svg className="w-56 h-56 transform -rotate-90 select-none" viewBox="0 0 260 260">
                          {channelPieSlices.map((slice, idx) => {
                            const isHovered = hoveredChannelSliceIndex === idx;
                            return (
                              <path
                                key={slice.item.channel_no}
                                d={slice.path}
                                fill={slice.color}
                                stroke="#020617"
                                strokeWidth={isHovered ? 3 : 1.5}
                                className="cursor-pointer transition-all duration-200"
                                opacity={hoveredChannelSliceIndex === null || isHovered ? 1 : 0.45}
                                onMouseEnter={() => setHoveredChannelSliceIndex(idx)}
                                onMouseLeave={() => setHoveredChannelSliceIndex(null)}
                              />
                            );
                          })}
                        </svg>
                      )}

                      {/* Donut Center Display */}
                      {activePeriodKills > 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                          {hoveredChannelSliceIndex !== null && activeChannelShare[hoveredChannelSliceIndex] ? (
                            <>
                              <span className="text-[11px] font-bold text-cyan-300 truncate max-w-[110px]">
                                {activeChannelShare[hoveredChannelSliceIndex].label}
                              </span>
                              <span className="text-xl font-extrabold font-mono text-white mt-0.5">
                                {activeChannelShare[hoveredChannelSliceIndex].percentage}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {activeChannelShare[hoveredChannelSliceIndex].count} 次击杀
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] uppercase tracking-wider text-cyan-300/90 font-semibold truncate max-w-[110px]">
                                {activePeriodItem?.shortTitle || '当前'}击杀量
                              </span>
                              <span className="text-2xl font-extrabold font-mono text-white mt-0.5">
                                {activePeriodKills}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {activeChannelShare.length} 个出怪频道
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Channel Legend on Right / Bottom */}
                    <div className="flex-1 w-full max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {activeChannelShare.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">该周期暂无频道数据</p>
                      ) : (
                        activeChannelShare.map((ch, idx) => {
                          const isHovered = hoveredChannelSliceIndex === idx;
                          return (
                            <div
                              key={ch.channel_no}
                              onMouseEnter={() => setHoveredChannelSliceIndex(idx)}
                              onMouseLeave={() => setHoveredChannelSliceIndex(null)}
                              className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                isHovered ? 'bg-slate-800/90 text-white' : 'hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: ch.color }}
                                />
                                <span className="truncate font-mono font-bold">{ch.label}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                                <span className="text-slate-400">{ch.count}次</span>
                                <span className="font-bold text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  {ch.percentage}%
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Footer notes */}
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>点击左侧条形图可切换周期</span>
                    <span className="font-mono">当前合计: {activePeriodKills} 次击杀</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: 每个人的击杀总数与明细排行榜 */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800/90 p-4 sm:p-5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                      每个人 / 角色的击杀总数统计明细表
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      全面掌握每位成员在日、周、月及全周期的击杀贡献与最近动态
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="按角色名 / 账号筛选..."
                    className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44"
                  />
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                      <th className="py-2 px-3 font-semibold w-14">排名</th>
                      <th className="py-2 px-3 font-semibold">角色名 / 账号</th>
                      <th className="py-2 px-3 font-semibold text-center font-mono">今日击杀</th>
                      <th className="py-2 px-3 font-semibold text-center font-mono">本周击杀</th>
                      <th className="py-2 px-3 font-semibold text-center font-mono">本月击杀</th>
                      <th className="py-2 px-3 font-semibold text-right font-mono">总击杀数</th>
                      <th className="py-2 px-4 font-semibold w-40 text-center">总占比</th>
                      <th className="py-2 px-3 font-semibold text-right">最近击杀记录</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          {stats?.totalKills === 0 ? '暂无击杀记录数据' : '没有匹配的角色'}
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member, index) => {
                        const rank = index + 1;
                        return (
                          <tr
                            key={member.game_id}
                            className="hover:bg-slate-900/60 transition-colors"
                          >
                            {/* Rank */}
                            <td className="py-2.5 px-3">
                              {rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[11px] border border-amber-500/50">
                                  1
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-slate-200 font-extrabold text-[11px] border border-slate-300/50">
                                  2
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700/20 text-amber-500 font-extrabold text-[11px] border border-amber-700/50">
                                  3
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono text-[11px] pl-1.5">
                                  {rank}
                                </span>
                              )}
                            </td>

                            {/* Character & Username */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: member.color }}
                                />
                                <div>
                                  <div className="font-bold text-white tracking-wide">
                                    {member.game_id}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    账号: {member.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Today Kills */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className={member.todayCount > 0 ? 'font-bold text-cyan-300' : 'text-slate-500'}>
                                {member.todayCount}
                              </span>
                            </td>

                            {/* This Week Kills */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className={member.weekCount > 0 ? 'font-bold text-emerald-300' : 'text-slate-500'}>
                                {member.weekCount}
                              </span>
                            </td>

                            {/* This Month Kills */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              <span className={member.monthCount > 0 ? 'font-bold text-violet-300' : 'text-slate-500'}>
                                {member.monthCount}
                              </span>
                            </td>

                            {/* Total Kills */}
                            <td className="py-2.5 px-3 text-right font-mono">
                              <strong className="text-sm font-extrabold text-white">
                                {member.totalCount}
                              </strong>
                              <span className="text-[10px] text-slate-500 ml-1">次</span>
                            </td>

                            {/* Share Progress Bar */}
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${Math.min(member.percentage, 100)}%`,
                                      backgroundColor: member.color,
                                    }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono font-semibold text-slate-300 w-12 text-right">
                                  {member.percentage}%
                                </span>
                              </div>
                            </td>

                            {/* Last Kill */}
                            <td className="py-2.5 px-3 text-right text-[11px] text-slate-400 font-mono">
                              {member.lastKilledAt ? (
                                <div>
                                  {member.lastChannelNo ? (
                                    <span className="text-cyan-400 font-bold mr-1">
                                      {member.lastChannelNo}频
                                    </span>
                                  ) : null}
                                  <span>{new Date(member.lastKilledAt).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                </div>
                              ) : (
                                <span className="text-slate-600">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
