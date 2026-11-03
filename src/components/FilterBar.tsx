import React from 'react';
import { Search, ArrowUpDown, Filter, Eye } from 'lucide-react';

export type StatusFilter = 'all' | 'waiting_entry' | 'in_spawn_window' | 'guaranteed_reached' | 'unrecorded';
export type SortOption = 'channel_asc' | 'entry_soon' | 'guaranteed_soon' | 'killed_desc';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  hasVisitorFilter: boolean;
  onHasVisitorChange: (val: boolean) => void;
  hasNoteFilter: boolean;
  onHasNoteChange: (val: boolean) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  hasVisitorFilter,
  onHasVisitorChange,
  hasNoteFilter,
  onHasNoteChange,
  sortOption,
  onSortChange,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 my-4 space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="按频道编号(如: 3)、玩家游戏ID、频道备注快速搜索..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
            >
              清除
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">排序方式</span>
          </div>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 cursor-pointer"
          >
            <option value="channel_asc">频道编号 (1～60)</option>
            <option value="entry_soon">⚡ 即将进刷优先</option>
            <option value="guaranteed_soon">🔥 即将保底优先</option>
            <option value="killed_desc">🕒 最近击杀时间</option>
          </select>
        </div>
      </div>

      {/* Filter tabs and quick toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
        {/* Segmented Status Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部频道
          </button>
          <button
            onClick={() => onStatusFilterChange('waiting_entry')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'waiting_entry'
                ? 'bg-sky-950/80 border border-sky-700/50 text-sky-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            等待进刷
          </button>
          <button
            onClick={() => onStatusFilterChange('in_spawn_window')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'in_spawn_window'
                ? 'bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            已进入刷时间
          </button>
          <button
            onClick={() => onStatusFilterChange('guaranteed_reached')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'guaranteed_reached'
                ? 'bg-rose-950/80 border border-rose-700/50 text-rose-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            已到保底
          </button>
          <button
            onClick={() => onStatusFilterChange('unrecorded')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'unrecorded'
                ? 'bg-slate-800/90 text-slate-200 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            未记录
          </button>
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onHasVisitorChange(!hasVisitorFilter)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
              hasVisitorFilter
                ? 'bg-purple-950/50 border-purple-700 text-purple-300 font-semibold'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>只看有人蹲守</span>
          </button>

          <button
            onClick={() => onHasNoteChange(!hasNoteFilter)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
              hasNoteFilter
                ? 'bg-amber-950/50 border-amber-700 text-amber-300 font-semibold'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>只看有备注</span>
          </button>
        </div>
      </div>
    </div>
  );
};
