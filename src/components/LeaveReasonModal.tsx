import React, { useState } from 'react';
import { LogOut, X, AlertCircle, MessageSquare } from 'lucide-react';

interface LeaveReasonModalProps {
  channelNo: number;
  gameId: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const PRESET_REASONS = [
  '临时有事离开',
  '点错频道误接',
  '药水/补给不足回城',
  '换线支援其他频道',
  '网络卡顿或掉线',
  '被抢线/有人护食',
];

export const LeaveReasonModal: React.FC<LeaveReasonModalProps> = ({
  channelNo,
  gameId,
  loading,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('请填写或选择退单理由后再提交！');
      return;
    }
    setError('');
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                确认退单 · <span className="text-amber-300 font-mono">{channelNo} 频道</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                接单角色：<strong className="text-purple-300">{gameId}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/80 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              快捷选择退单理由：
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setReason(preset);
                    setError('');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    reason === preset
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-xs'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>退单理由说明 <span className="text-rose-400">*必填</span></span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="请填写本次退单的具体原因（管理员可在后台查看退单记录与统计）..."
              className="w-full bg-slate-950 border border-slate-700/90 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors resize-none"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? '正在提交退单...' : '确认提交退单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
