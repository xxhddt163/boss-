import React, { useState } from 'react';
import { User } from '../types.ts';
import { api } from '../services/api.ts';
import { formatBeijing } from '../utils/time.ts';
import { sound } from '../utils/sound.ts';
import {
  BellRing,
  UserCheck,
  CheckCircle2,
  Clock,
  Phone,
  Gamepad2,
  ArrowRight,
  X,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface PendingApprovalModalProps {
  pendingUsers: User[];
  onClose: () => void;
  onOpenAdminUsers: () => void;
  onUsersApproved: () => void;
}

export const PendingApprovalModal: React.FC<PendingApprovalModalProps> = ({
  pendingUsers,
  onClose,
  onOpenAdminUsers,
  onUsersApproved,
}) => {
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleApproveSingle = async (user: User) => {
    try {
      setApprovingIds((prev) => new Set(prev).add(user.id));
      setFeedback(null);
      await api.setUserStatus(user.id, 'active');
      sound.playClick();
      setFeedback({ type: 'success', message: `账号【${user.game_id || user.username}】已成功审核通过！` });
      onUsersApproved();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '审核失败，请重试' });
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  const handleBatchApproveAll = async () => {
    try {
      setBatchLoading(true);
      setFeedback(null);
      const res = await api.batchApproveUsers();
      sound.playClick();
      setFeedback({ type: 'success', message: res.message || '所有待审核账号已全部通过！' });
      onUsersApproved();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || '一键通过失败，请重试' });
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-amber-950/30 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">待审核账号提醒</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 border border-amber-500/50 text-amber-300">
                  {pendingUsers.length} 位待审核
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                新玩家已提交注册申请，审核通过后他们方可登录系统
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="稍后处理"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/70 border-rose-800/80 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mb-3" />
              <p className="text-base font-semibold text-slate-200">所有注册账号已全部审核完毕！</p>
              <p className="text-xs text-slate-500 mt-1">目前暂无待审核的用户申请</p>
            </div>
          ) : (
            pendingUsers.map((user) => {
              const isApproving = approvingIds.has(user.id);
              return (
                <div
                  key={user.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300 font-bold font-mono shrink-0">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{user.username}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/70 border border-purple-800/70 text-purple-300">
                          <Gamepad2 className="w-3 h-3 text-purple-400" />
                          <span>角色: {user.game_id || '未填'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {user.phone || '无手机号'}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-slate-500">
                          <Clock className="w-3 h-3 text-slate-600" />
                          {formatBeijing(user.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleApproveSingle(user)}
                      disabled={isApproving || batchLoading}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      {isApproving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      <span>通过审核</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onOpenAdminUsers}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
          >
            <span>进入管理员后台查看完整账号列表</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors font-medium"
            >
              稍后处理
            </button>

            {pendingUsers.length > 0 && (
              <button
                onClick={handleBatchApproveAll}
                disabled={batchLoading}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 disabled:opacity-50 rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {batchLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                )}
                <span>一键全部通过 ({pendingUsers.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
