import React, { useState, useEffect } from 'react';
import { KillRecord, User } from '../types.ts';
import { api } from '../services/api.ts';
import { formatBeijing } from '../utils/time.ts';
import {
  X,
  PlusCircle,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  AlertCircle,
  FileText,
  Clock,
  UserCheck,
} from 'lucide-react';

interface ChannelDetailModalProps {
  channelNo: number;
  currentUser: User | null;
  onClose: () => void;
  onRefreshChannels: () => void;
}

export const ChannelDetailModal: React.FC<ChannelDetailModalProps> = ({
  channelNo,
  currentUser,
  onClose,
  onRefreshChannels,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [records, setRecords] = useState<KillRecord[]>([]);
  const [channelNote, setChannelNote] = useState<string>('');
  const [editNoteMode, setEditNoteMode] = useState<boolean>(false);
  const [newNoteVal, setNewNoteVal] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Manual backfill form state
  const [showBackfill, setShowBackfill] = useState<boolean>(false);
  const [bfTime, setBfTime] = useState<string>('');
  const [bfGameId, setBfGameId] = useState<string>('');
  const [bfNote, setBfNote] = useState<string>('');

  // Edit record state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState<string>('');
  const [editGameId, setEditGameId] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Void record state
  const [voidingRecordId, setVoidingRecordId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getChannelHistory(channelNo);
      setRecords(res.records);
      setChannelNote(res.channelNote || '');
      setNewNoteVal(res.channelNote || '');
    } catch (err: any) {
      setErrorMsg(err.message || '加载频道历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (currentUser) {
      setBfGameId(currentUser.game_id);
    }
  }, [channelNo]);

  // Handle channel long-term note save (Admin only)
  const handleSaveNote = async () => {
    try {
      setErrorMsg('');
      await api.updateChannelNote(channelNo, newNoteVal);
      setChannelNote(newNoteVal);
      setEditNoteMode(false);
      setSuccessMsg('频道长期备注已更新');
      onRefreshChannels();
    } catch (err: any) {
      setErrorMsg(err.message || '更新长期备注失败');
    }
  };

  // Handle manual backfill
  const handleBackfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bfTime) {
      setErrorMsg('请选择实际击杀时间');
      return;
    }
    try {
      setErrorMsg('');
      await api.backfillKill(channelNo, {
        killed_at: new Date(bfTime).toISOString(),
        game_id: bfGameId || currentUser?.game_id,
        kill_note: bfNote,
      });
      setSuccessMsg('手动补录击杀成功！已重新计算进刷与保底时间。');
      setShowBackfill(false);
      setBfNote('');
      loadData();
      onRefreshChannels();
    } catch (err: any) {
      setErrorMsg(err.message || '补录失败');
    }
  };

  // Handle edit record
  const startEdit = (rec: KillRecord) => {
    setEditingRecordId(rec.id);
    // Format to datetime-local input string YYYY-MM-DDTHH:mm
    const d = new Date(rec.killed_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setEditTime(localIso);
    setEditGameId(rec.game_id);
    setEditNote(rec.kill_note || '');
  };

  const saveEdit = async (recordId: string) => {
    try {
      setErrorMsg('');
      await api.editKillRecord(channelNo, recordId, {
        killed_at: editTime ? new Date(editTime).toISOString() : undefined,
        game_id: editGameId,
        kill_note: editNote,
      });
      setEditingRecordId(null);
      setSuccessMsg('记录修改成功，已重新计算刷新时间');
      loadData();
      onRefreshChannels();
    } catch (err: any) {
      setErrorMsg(err.message || '修改失败');
    }
  };

  // Handle void record
  const confirmVoid = async (recordId: string) => {
    if (!voidReason.trim()) {
      setErrorMsg('请输入撤销原因');
      return;
    }
    try {
      setErrorMsg('');
      await api.voidKillRecord(channelNo, recordId, voidReason);
      setVoidingRecordId(null);
      setVoidReason('');
      setSuccessMsg('记录已撤销（数据库中已保留历史，并不再参与刷新计算）');
      loadData();
      onRefreshChannels();
    } catch (err: any) {
      setErrorMsg(err.message || '撤销失败');
    }
  };

  // Handle restore record (Admin only)
  const handleRestore = async (recordId: string) => {
    try {
      setErrorMsg('');
      await api.restoreKillRecord(channelNo, recordId);
      setSuccessMsg('记录已成功恢复并重新纳入频道状态计算');
      loadData();
      onRefreshChannels();
    } catch (err: any) {
      setErrorMsg(err.message || '恢复失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black font-mono text-cyan-400 tabular-nums">
              {channelNo}
            </span>
            <span className="text-base font-bold text-white">频道 · 击杀历史与记录管理</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-950/80 border-b border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
          {/* Channel Long-Term Note Box */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>频道长期备注</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  （与单次击杀备注分离，仅管理员可修改）
                </span>
              </div>
              {currentUser?.role === 'admin' && !editNoteMode && (
                <button
                  onClick={() => setEditNoteMode(true)}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>编辑长期备注</span>
                </button>
              )}
            </div>

            {editNoteMode ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newNoteVal}
                  onChange={(e) => setNewNoteVal(e.target.value)}
                  placeholder="输入频道长期备注（如：公会固定蹲守线）..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSaveNote}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditNoteMode(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                >
                  取消
                </button>
              </div>
            ) : (
              <p className="text-slate-300 italic">
                {channelNote || '暂无长期备注'}
              </p>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>击杀记录历史 ({records.length}条)</span>
            </div>

            {currentUser && (
              <button
                onClick={() => setShowBackfill(!showBackfill)}
                className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-700/60 hover:bg-cyan-900/60 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{showBackfill ? '关闭补录' : '手动补录历史击杀'}</span>
              </button>
            )}
          </div>

          {/* Manual Backfill Panel */}
          {showBackfill && (
            <form
              onSubmit={handleBackfill}
              className="p-4 rounded-xl bg-slate-950/80 border border-cyan-800/60 space-y-3"
            >
              <div className="font-semibold text-cyan-300">
                手动补录击杀记录
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    实际击杀时间 *
                  </label>
                  <input
                    type="datetime-local"
                    value={bfTime}
                    onChange={(e) => setBfTime(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    击杀玩家游戏 ID
                  </label>
                  <input
                    type="text"
                    value={bfGameId}
                    onChange={(e) => setBfGameId(e.target.value)}
                    placeholder="玩家游戏ID"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    本次击杀备注
                  </label>
                  <input
                    type="text"
                    value={bfNote}
                    onChange={(e) => setBfNote(e.target.value)}
                    placeholder="可选，如：掉落装备情况"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBackfill(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-sm"
                >
                  确认补录
                </button>
              </div>
            </form>
          )}

          {/* Records Table */}
          {loading ? (
            <div className="py-12 text-center text-slate-500">正在加载击杀记录...</div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-slate-500 rounded-xl bg-slate-950/30 border border-slate-800/40">
              暂无击杀记录。当玩家在此频道击杀或补录后，将显示在此处。
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => {
                const isEditing = editingRecordId === rec.id;
                const isVoiding = voidingRecordId === rec.id;

                return (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-xl border transition-colors ${
                      rec.is_void
                        ? 'bg-slate-950/30 border-slate-800/50 opacity-60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3 p-2 bg-slate-900/90 rounded-lg border border-cyan-800/60">
                        <div className="font-semibold text-cyan-300">编辑击杀记录</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">击杀时间</label>
                            <input
                              type="datetime-local"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">游戏 ID</label>
                            <input
                              type="text"
                              value={editGameId}
                              onChange={(e) => setEditGameId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">本次备注</label>
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingRecordId(null)}
                            className="px-3 py-1 bg-slate-800 text-slate-300 rounded"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => saveEdit(rec.id)}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded"
                          >
                            保存修改
                          </button>
                        </div>
                      </div>
                    ) : isVoiding ? (
                      <div className="space-y-2 p-2 bg-rose-950/40 rounded-lg border border-rose-800/60">
                        <div className="font-semibold text-rose-300">撤销该击杀记录</div>
                        <p className="text-[11px] text-slate-400">
                          撤销后记录将在历史中保留审计，但不再参与频道刷新时间与倒计时计算。
                        </p>
                        <input
                          type="text"
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          placeholder="请输入撤销原因（如：误按击杀按钮、时间填错等）..."
                          className="w-full bg-slate-950 border border-rose-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setVoidingRecordId(null)}
                            className="px-3 py-1 bg-slate-800 text-slate-300 rounded"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => confirmVoid(rec.id)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded"
                          >
                            确认撤销
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Record Info */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-semibold text-white tabular-nums">
                              {formatBeijing(rec.killed_at)}
                            </span>
                            {rec.is_void ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-950 border border-rose-800 text-rose-400">
                                已撤销
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                                有效
                              </span>
                            )}
                            <span className="text-slate-500">·</span>
                            <span className="text-purple-300 font-semibold">{rec.game_id}</span>
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-400">创建人: {rec.created_by}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                            <span>进刷: {formatBeijing(rec.entry_at)}</span>
                            <span>保底: {formatBeijing(rec.guaranteed_at)}</span>
                            {rec.kill_note && (
                              <span className="text-amber-200/90 font-medium">备注: {rec.kill_note}</span>
                            )}
                          </div>

                          {rec.is_void && (
                            <div className="text-[11px] text-rose-300/90">
                              撤销人: {rec.voided_by || '管理员'} · 原因: {rec.void_reason || '未提供'} (撤销于 {formatBeijing(rec.voided_at)})
                            </div>
                          )}

                          {rec.updated_by && !rec.is_void && (
                            <div className="text-[10px] text-slate-400">
                              最后修改人: {rec.updated_by} · 修改时间: {formatBeijing(rec.updated_at)}
                            </div>
                          )}
                        </div>

                        {/* Record Actions */}
                        <div className="flex items-center gap-2 shrink-0 justify-end">
                          {!rec.is_void && currentUser && (
                            <>
                              <button
                                onClick={() => startEdit(rec)}
                                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center gap-1"
                                title="修改击杀时间、游戏ID或备注"
                              >
                                <Edit2 className="w-3 h-3 text-cyan-400" />
                                <span>修改</span>
                              </button>
                              <button
                                onClick={() => {
                                  setVoidingRecordId(rec.id);
                                  setVoidReason('');
                                }}
                                className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/60 rounded transition-colors flex items-center gap-1"
                                title="撤销该错误记录"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>撤销</span>
                              </button>
                            </>
                          )}

                          {rec.is_void && currentUser?.role === 'admin' && (
                            <button
                              onClick={() => handleRestore(rec.id)}
                              className="px-2.5 py-1 text-xs text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80 rounded transition-colors flex items-center gap-1"
                              title="管理员恢复已撤销记录"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>恢复有效</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>所有操作均写入数据库审计日志，撤销记录保留永久痕迹。</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
