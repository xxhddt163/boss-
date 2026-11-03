import React from 'react';
import { Swords, AlertTriangle, Clock, User, X } from 'lucide-react';
import { formatBeijing, getCurrentServerTime } from '../utils/time.ts';

interface KillConfirmModalProps {
  channelNo: number;
  gameId: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const KillConfirmModal: React.FC<KillConfirmModalProps> = ({
  channelNo,
  gameId,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const nowDisplay = formatBeijing(getCurrentServerTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>确认击杀登记</span>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">目标频道</span>
              <span className="text-lg font-black font-mono text-cyan-300">
                {channelNo} 频道
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span className="text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span>登记玩家 ID</span>
              </span>
              <span className="font-semibold text-purple-300">{gameId}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/60 pt-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>服务器击杀时间</span>
              </span>
              <span className="font-mono text-slate-200 tabular-nums">{nowDisplay}</span>
            </div>
          </div>

          <p className="text-slate-400 text-[11px] leading-relaxed">
            ⚠️ 请仔细核对频道是否正确。确认后将立即使用当前服务器时间重新计算进刷时间与保底时间，并将自动完成并退出本次接单。
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg transition-all shadow-md shadow-red-950/50 flex items-center gap-1.5 active:scale-95"
            >
              <Swords className="w-4 h-4" />
              <span>{loading ? '正在登记...' : '确认击杀'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
