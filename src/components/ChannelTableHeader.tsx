import React from 'react';

interface ChannelTableHeaderProps {
  miniMode?: boolean;
}

export const ChannelTableHeader: React.FC<ChannelTableHeaderProps> = ({ miniMode = false }) => {
  return (
    <div
      className={`sticky top-0 z-20 bg-slate-900/98 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 sm:px-3.5 py-2 mb-2 shadow-md text-xs font-semibold text-slate-300 select-none ${
        miniMode ? 'w-fit' : 'w-full min-w-[860px]'
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* 1. 频道号 */}
        <div className="w-18 sm:w-22 shrink-0 text-slate-300 font-bold">
          频道号
        </div>

        {/* 2. 标签 */}
        <div className="w-16 sm:w-20 shrink-0 text-slate-300">
          频道标签
        </div>

        {/* 3. 距离进刷时间 */}
        <div className="w-30 sm:w-34 shrink-0 text-cyan-300 font-bold">
          距离进刷时间
        </div>

        {/* 4. 最近击杀时间 */}
        <div className="w-22 sm:w-26 shrink-0 text-slate-300">
          最近击杀
        </div>

        {/* 5. 进刷时间 */}
        <div className="w-22 sm:w-26 shrink-0 text-rose-400">
          进刷 (+60m)
        </div>

        {/* 6. 保底时间 */}
        <div className="w-22 sm:w-26 shrink-0 text-sky-400">
          保底 (+90m)
        </div>

        {/* 7. 当前蹲守玩家 */}
        <div className="w-20 sm:w-24 shrink-0 text-purple-300">
          当前蹲守玩家
        </div>

        {/* 8. 频道长期备注 */}
        <div className={miniMode ? 'w-28 shrink-0 text-amber-300' : 'flex-1 min-w-[50px] text-amber-300'}>
          长期备注
        </div>

        {/* 9. 操作区 */}
        <div className="w-48 sm:w-56 shrink-0 text-right pr-1 text-slate-300 font-bold">
          操作
        </div>
      </div>
    </div>
  );
};
