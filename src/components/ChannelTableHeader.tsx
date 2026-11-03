import React from 'react';

export const ChannelTableHeader: React.FC = () => {
  return (
    <div className="sticky top-0 z-20 bg-slate-900/98 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-2 mb-2.5 shadow-md w-full min-w-[960px] text-xs font-semibold text-slate-300 select-none">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* 1. 频道号 */}
        <div className="w-20 sm:w-24 shrink-0 text-slate-300 font-bold">
          频道号
        </div>

        {/* 2. 标签 */}
        <div className="w-20 sm:w-24 shrink-0 text-slate-300">
          频道标签
        </div>

        {/* 3. 距离进刷时间 */}
        <div className="w-32 sm:w-36 shrink-0 text-cyan-300 font-bold">
          距离进刷时间
        </div>

        {/* 4. 最近击杀时间 */}
        <div className="w-24 sm:w-28 shrink-0 text-slate-300">
          最近击杀
        </div>

        {/* 5. 进刷时间 */}
        <div className="w-24 sm:w-28 shrink-0 text-sky-400">
          进刷 (+60m)
        </div>

        {/* 6. 保底时间 */}
        <div className="w-24 sm:w-28 shrink-0 text-rose-400">
          保底 (+90m)
        </div>

        {/* 7. 当前蹲守玩家 */}
        <div className="w-28 sm:w-32 shrink-0 text-purple-300">
          当前蹲守玩家
        </div>

        {/* 8. 频道长期备注 */}
        <div className="flex-1 min-w-[80px] text-amber-300">
          长期备注
        </div>

        {/* 9. 操作区 */}
        <div className="w-48 sm:w-52 shrink-0 text-right pr-1 text-slate-300 font-bold">
          操作 (记录 / 接单 / 击杀)
        </div>
      </div>
    </div>
  );
};
