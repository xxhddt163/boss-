import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { User, BossConfig, OperationLog, SystemSettings } from '../types.ts';
import { formatBeijing } from '../utils/time.ts';
import {
  X,
  Users,
  Sliders,
  FileSpreadsheet,
  Database,
  Check,
  Ban,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  AlertCircle,
  Archive,
} from 'lucide-react';

interface AdminModalProps {
  onClose: () => void;
  onDataChanged: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ onClose, onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'rules' | 'logs' | 'backup'>('users');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // 1. Users management state
  const [users, setUsers] = useState<User[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGameId, setEditGameId] = useState<string>('');
  const [editRole, setEditRole] = useState<'admin' | 'player'>('player');

  // 2. Boss config state
  const [bossName, setBossName] = useState<string>('驮狼雪人');
  const [entryInterval, setEntryInterval] = useState<number>(60);
  const [guaranteedInterval, setGuaranteedInterval] = useState<number>(90);
  const [reminderBefore, setReminderBefore] = useState<number>(5);

  // 3. Logs state
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [logSearchAction, setLogSearchAction] = useState<string>('');
  const [logSearchUser, setLogSearchUser] = useState<string>('');
  const [logSearchChannel, setLogSearchChannel] = useState<string>('');
  const [logPageSize, setLogPageSize] = useState<number>(200); // 0 means show all
  const [logCurrentPage, setLogCurrentPage] = useState<number>(1);

  // 4. Backups state
  const [backups, setBackups] = useState<{ name: string; size: number; created_at: string }[]>([]);
  const [importJsonText, setImportJsonText] = useState<string>('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setErrorMsg(err.message || '加载用户失败');
    } finally {
      setLoading(false);
    }
  };

  const loadBossAndSettings = async () => {
    try {
      const res = await api.getChannels();
      setBossName(res.boss.boss_name);
      setEntryInterval(res.boss.entry_interval);
      setGuaranteedInterval(res.boss.guaranteed_interval);
      setReminderBefore(res.settings.reminder_before || 5);
    } catch {
      // ignore
    }
  };

  const loadLogs = async (overrides?: { action?: string; user?: string; channel?: string }) => {
    try {
      setLoading(true);
      const actVal = overrides?.action !== undefined ? overrides.action : logSearchAction;
      const usrVal = overrides?.user !== undefined ? overrides.user : logSearchUser;
      const chVal = overrides?.channel !== undefined ? overrides.channel : logSearchChannel;
      const parsedCh = chVal ? parseInt(chVal, 10) : undefined;
      const res = await api.getAuditLogs({
        action: actVal || undefined,
        username: usrVal || undefined,
        channel_no: parsedCh && !isNaN(parsedCh) ? parsedCh : undefined,
      });
      setLogs(res.logs || []);
      setLogCurrentPage(1);
    } catch (err: any) {
      setErrorMsg(err.message || '加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      const res = await api.getBackups();
      setBackups(res.backups);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'rules') loadBossAndSettings();
    if (activeTab === 'logs') loadLogs();
    if (activeTab === 'backup') loadBackups();
  }, [activeTab]);

  // Actions for Users
  const handleUserStatusChange = async (userId: string, status: 'active' | 'disabled') => {
    try {
      setErrorMsg('');
      await api.setUserStatus(userId, status);
      setSuccessMsg(`用户状态已更新为：${status === 'active' ? '已启用' : '已禁用'}`);
      loadUsers();
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || '操作失败');
    }
  };

  const handleSaveUserProfile = async (userId: string) => {
    try {
      setErrorMsg('');
      await api.updateUserProfile(userId, {
        game_id: editGameId,
        role: editRole,
      });
      setEditingUserId(null);
      setSuccessMsg('用户资料已更新');
      loadUsers();
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || '更新失败');
    }
  };

  // Actions for Boss Rules
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg('');
      await api.updateBossConfig({
        boss_name: bossName,
        entry_interval: entryInterval,
        guaranteed_interval: guaranteedInterval,
      });
      await api.updateSettings({
        reminder_before: reminderBefore,
      });
      setSuccessMsg('Boss刷新时间与提醒规则配置已保存，已为所有未撤销击杀记录重新计算！');
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || '保存规则失败');
    }
  };

  // Actions for Backups
  const handleCreateBackup = async () => {
    try {
      setErrorMsg('');
      const res = await api.createBackup();
      setSuccessMsg(`手动备份创建成功：${res.filename}`);
      loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || '创建备份失败');
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm(`确定要从备份 ${filename} 还原系统数据吗？还原前系统会自动生成当前状态的安全快照。`)) return;
    try {
      setErrorMsg('');
      await api.restoreBackup(filename);
      setSuccessMsg('数据已成功还原！');
      loadBackups();
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || '还原失败');
    }
  };

  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      setErrorMsg('请粘贴备份 JSON 文本');
      return;
    }
    try {
      const data = JSON.parse(importJsonText);
      await api.importDatabase(data);
      setSuccessMsg('数据库导入成功！');
      setImportJsonText('');
      onDataChanged();
    } catch (err: any) {
      setErrorMsg(err.message || '导入数据格式有误');
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('确定要将系统数据库完全清空并重置为全新空白状态吗？\n所有击杀记录、频道访问人员和长期备注都将被清空，仅保留管理员账号。')) return;
    try {
      setErrorMsg('');
      const res = await api.resetDatabase();
      setSuccessMsg(res.message);
      onDataChanged();
      loadBackups();
    } catch (err: any) {
      setErrorMsg(err.message || '重置数据库失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white">管理员后台控制中心</span>
            <span className="text-xs text-cyan-400 font-medium bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-0.5 rounded-full">
              超级管理权限
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>用户审核与账号管理</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Boss 刷新规则配置</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>全量操作审计日志</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'backup'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>数据备份、恢复与导入导出</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-300">
          {/* TAB 1: Users */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">注册用户审核与权限设置</h3>
                  <p className="text-slate-400 text-[11px]">
                    新注册用户默认为“待审核”状态，必须审核启用后才能访问频道及提交击杀。
                  </p>
                </div>
                <button
                  onClick={loadUsers}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>刷新用户列表</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-semibold">用户名</th>
                      <th className="py-2.5 px-3 font-semibold">游戏角色 ID</th>
                      <th className="py-2.5 px-3 font-semibold">联系电话</th>
                      <th className="py-2.5 px-3 font-semibold">角色</th>
                      <th className="py-2.5 px-3 font-semibold">状态</th>
                      <th className="py-2.5 px-3 font-semibold">注册时间</th>
                      <th className="py-2.5 px-3 font-semibold text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                    {users.map((u) => {
                      const isEditing = editingUserId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-900/60">
                          <td className="py-2.5 px-3 font-semibold text-white font-mono">
                            {u.username}
                          </td>
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editGameId}
                                onChange={(e) => setEditGameId(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                              />
                            ) : (
                              <span className="text-purple-300 font-semibold">{u.game_id}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{u.phone}</td>
                          <td className="py-2.5 px-3">
                            {isEditing && u.username !== 'admin' ? (
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as any)}
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs"
                              >
                                <option value="player">普通玩家</option>
                                <option value="admin">管理员</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  u.role === 'admin'
                                    ? 'bg-cyan-950 border border-cyan-800 text-cyan-400'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {u.role === 'admin' ? '管理员' : '玩家'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                u.status === 'active'
                                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                                  : u.status === 'pending'
                                  ? 'bg-amber-950 border border-amber-800 text-amber-300 animate-pulse'
                                  : 'bg-rose-950 border border-rose-800 text-rose-400'
                              }`}
                            >
                              {u.status === 'active'
                                ? '已启用'
                                : u.status === 'pending'
                                ? '待审核'
                                : '已禁用'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 tabular-nums">
                            {formatBeijing(u.created_at)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleSaveUserProfile(u.id)}
                                  className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-[11px]"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingUserId(u.id);
                                    setEditGameId(u.game_id);
                                    setEditRole(u.role);
                                  }}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                                >
                                  编辑资料
                                </button>
                                {u.status === 'pending' && (
                                  <button
                                    onClick={() => handleUserStatusChange(u.id, 'active')}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>通过审核</span>
                                  </button>
                                )}
                                {u.status === 'active' && u.username !== 'admin' && (
                                  <button
                                    onClick={() => handleUserStatusChange(u.id, 'disabled')}
                                    className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[11px] flex items-center gap-1"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>禁用账号</span>
                                  </button>
                                )}
                                {u.status === 'disabled' && (
                                  <button
                                    onClick={() => handleUserStatusChange(u.id, 'active')}
                                    className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-700 text-emerald-300 rounded text-[11px]"
                                  >
                                    重新启用
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Boss Rules */}
          {activeTab === 'rules' && (
            <form onSubmit={handleSaveRules} className="max-w-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Boss 刷新规则配置</h3>
                <p className="text-slate-400 text-[11px]">
                  普通玩家无法修改刷新规则。规则修改后，系统将自动重新计算所有频道的进刷时间与保底时间。
                </p>
              </div>

              <div className="space-y-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Boss 监控名称</label>
                  <input
                    type="text"
                    value={bossName}
                    onChange={(e) => setBossName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      进刷间隔时间 (分钟) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={entryInterval}
                      onChange={(e) => setEntryInterval(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                    />
                    <span className="text-[11px] text-slate-500">默认 60 分钟 (击杀 + 60m)</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      保底间隔时间 (分钟) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={guaranteedInterval}
                      onChange={(e) => setGuaranteedInterval(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                    />
                    <span className="text-[11px] text-slate-500">默认 90 分钟 (击杀 + 90m)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    提前提醒时间 (分钟)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={reminderBefore}
                    onChange={(e) => setReminderBefore(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                  />
                  <span className="text-[11px] text-slate-500">
                    默认提前 5 分钟播放水晶提示音并触发桌面弹窗
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-md transition-colors"
                >
                  保存并重算全服频道刷新时间
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Audit Logs */}
          {activeTab === 'logs' && (() => {
            const ACTION_LABELS: Record<string, string> = {
              KILL_RECORD_CREATE: '击杀登记',
              KILL_RECORD_BACKFILL: '手动补录',
              KILL_RECORD_EDIT: '修改记录',
              KILL_RECORD_VOID: '撤销记录',
              KILL_RECORD_RESTORE: '恢复记录',
              CONCURRENT_KILL_CLICK: '多人并发点击',
              CHANNEL_VISIT: '频道接单',
              CHANNEL_LEAVE: '频道退单',
              CHANNEL_RESET: '管理员重置频道',
              CHANNEL_RESET_TIMES: '管理员重置频道',
              CHANNEL_AUTO_RESET_OVERDUE_180M: '超时自动重置',
              CHANNEL_TAG_UPDATE: '更新频道标签',
              CHANNEL_NOTE_UPDATE: '更新长期备注',
              USER_LOGIN: '用户登录',
              USER_REGISTER: '申请注册',
              USER_CHANGE_PASSWORD: '修改密码',
              USER_PASSWORD_CHANGE: '修改密码',
              USER_APPROVE: '审核通过账号',
              ADMIN_USER_STATUS_CHANGE: '账号状态变更',
              ADMIN_USER_BATCH_APPROVE: '批量审核通过',
              ADMIN_USER_PROFILE_UPDATE: '修改用户资料',
              ADMIN_BOSS_CONFIG_UPDATE: '修改刷新规则',
              ADMIN_SETTINGS_UPDATE: '修改系统设置',
              ADMIN_DATABASE_IMPORT: '导入数据库',
              ADMIN_DB_IMPORT: '导入数据库',
              ADMIN_BACKUP_CREATE: '创建数据备份',
              ADMIN_BACKUP_RESTORE: '还原数据备份',
              ADMIN_DATABASE_RESET: '清空重置数据库',
              ADMIN_DB_RESET: '清空重置数据库',
            };

            const STATUS_LABELS: Record<string, string> = {
              active: '已启用',
              disabled: '已禁用',
              pending: '待审核',
            };

            const ROLE_LABELS: Record<string, string> = {
              admin: '管理员',
              player: '普通玩家',
            };

            // Translate technical log data into plain, user-friendly Chinese
            const translateLogDetail = (l: OperationLog): string => {
              const od = l.old_data || {};
              const nd = l.new_data || {};
              const chText = l.channel_no ? `${l.channel_no}频道` : nd.channelNo ? `${nd.channelNo}频道` : nd.channel_no ? `${nd.channel_no}频道` : '';

              switch (l.action) {
                case 'KILL_RECORD_CREATE':
                  return `角色【${nd.game_id || l.username}】在 ${chText} 完成了击杀登记｜击杀时间：${formatBeijing(nd.killed_at)}｜预计进刷：${formatBeijing(nd.entry_at)}｜保底时间：${formatBeijing(nd.guaranteed_at)}`;

                case 'KILL_RECORD_BACKFILL':
                  return `角色【${nd.game_id || l.username}】在 ${chText} 手动补录了历史击杀｜补录击杀时间：${formatBeijing(nd.killed_at)}${nd.kill_note ? `｜备注：${nd.kill_note}` : ''}`;

                case 'KILL_RECORD_EDIT': {
                  const changes: string[] = [];
                  if (od.killed_at !== nd.killed_at) {
                    changes.push(`击杀时间由【${formatBeijing(od.killed_at)}】改为【${formatBeijing(nd.killed_at)}】`);
                  }
                  if (od.game_id !== nd.game_id) {
                    changes.push(`击杀角色由【${od.game_id || '无'}】改为【${nd.game_id || '无'}】`);
                  }
                  if ((od.kill_note || '') !== (nd.kill_note || '')) {
                    changes.push(`备注由【${od.kill_note || '无'}】改为【${nd.kill_note || '无'}】`);
                  }
                  if (changes.length === 0) {
                    return `重新保存了 ${chText} 的击杀记录（击杀时间：${formatBeijing(nd.killed_at)}，角色：${nd.game_id || l.username}）`;
                  }
                  return `修改了 ${chText} 的击杀记录：${changes.join('；')}`;
                }

                case 'KILL_RECORD_VOID':
                  return `撤销了 ${chText} 的一条击杀记录｜撤销原因：【${nd.void_reason || '未填写'}】｜操作人：${nd.voided_by || l.username}`;

                case 'KILL_RECORD_RESTORE':
                  return `管理员【${nd.restored_by || l.username}】恢复了 ${chText} 此前被撤销的击杀记录`;

                case 'CONCURRENT_KILL_CLICK':
                  return `角色【${nd.game_id || l.username}】在 ${chText} 同一轮多人同时点击击杀，系统已按最后一次点击将击杀时间从【${formatBeijing(od.killed_at)}】更新为【${formatBeijing(nd.killed_at)}】`;

                case 'CHANNEL_VISIT':
                  return `角色【${nd.game_id || l.username}】接单蹲守 ${chText}${
                    nd.leftOtherChannel ? `（系统已自动为您退出此前接单的 ${nd.leftOtherChannel} 频道）` : ''
                  }`;

                case 'CHANNEL_LEAVE':
                  return `角色【${nd.game_id || l.username}】退出了 ${chText} 的接单｜退单理由：【${nd.leave_reason || '未填写'}】${
                    nd.joined_at ? `｜接单时间：${formatBeijing(nd.joined_at)}` : ''
                  }`;

                case 'CHANNEL_RESET':
                case 'CHANNEL_RESET_TIMES':
                  return `管理员将 ${chText} 的所有倒计时与时间信息初始化为空（保留当前接单人员，清空频道标签，历史击杀记录不作废）`;

                case 'CHANNEL_AUTO_RESET_OVERDUE_180M':
                  return `${chText} 超过保底时间已达 ${nd.overdue_minutes ?? 180} 分钟未登记新击杀，系统自动将该频道时间初始化为空（保留接单人员，清空标签）`;

                case 'CHANNEL_TAG_UPDATE':
                  return `${chText} 标签变更：由【${od.tag || '无标签'}】修改为【${nd.tag || '无标签（已清除）'}】`;

                case 'CHANNEL_NOTE_UPDATE':
                  return `${chText} 长期备注变更：由【${od.note || '无备注'}】修改为【${nd.note || '无备注（已清空）'}】`;

                case 'USER_LOGIN':
                  return `账号【${l.username}】成功登录系统`;

                case 'USER_REGISTER':
                  return `新玩家提交了注册申请｜登录账号：【${nd.username || l.username}】｜游戏角色名：【${nd.game_id || '--'}】｜联系电话：${nd.phone || '--'}（等待管理员审核）`;

                case 'USER_CHANGE_PASSWORD':
                case 'USER_PASSWORD_CHANGE':
                  return `账号【${l.username}】修改了登录密码`;

                case 'USER_APPROVE':
                case 'ADMIN_USER_BATCH_APPROVE':
                  return `管理员审核通过了账号【${nd.target_username || '--'}】（游戏角色名：【${nd.target_game_id || '--'}】），该账号现可正常登录`;

                case 'ADMIN_USER_STATUS_CHANGE':
                  return `管理员将账号【${od.username || '--'}】的状态由【${STATUS_LABELS[od.status] || od.status || '--'}】修改为【${STATUS_LABELS[nd.status] || nd.status || '--'}】`;

                case 'ADMIN_USER_PROFILE_UPDATE': {
                  const pChanges: string[] = [];
                  if (od.game_id !== nd.game_id) pChanges.push(`游戏角色名由【${od.game_id || '无'}】改为【${nd.game_id || '无'}】`);
                  if (od.role !== nd.role) pChanges.push(`权限角色由【${ROLE_LABELS[od.role] || od.role}】改为【${ROLE_LABELS[nd.role] || nd.role}】`);
                  if (od.phone !== nd.phone && nd.phone !== undefined) pChanges.push(`电话由【${od.phone || '无'}】改为【${nd.phone || '无'}】`);
                  return pChanges.length > 0
                    ? `管理员修改了用户资料：${pChanges.join('；')}`
                    : `管理员更新了用户资料（角色名：${nd.game_id || '--'}，身份：${ROLE_LABELS[nd.role] || nd.role || '--'}）`;
                }

                case 'ADMIN_BOSS_CONFIG_UPDATE':
                  return `管理员更新了 Boss 刷新规则：Boss名称【${nd.boss_name || '驮狼雪人'}】，进刷间隔由 ${od.entry_interval ?? '--'} 分钟改为 ${nd.entry_interval ?? '--'} 分钟，保底间隔由 ${od.guaranteed_interval ?? '--'} 分钟改为 ${nd.guaranteed_interval ?? '--'} 分钟`;

                case 'ADMIN_SETTINGS_UPDATE':
                  return `管理员更新了系统设置：进刷前提前 ${nd.reminder_before ?? 5} 分钟触发提醒`;

                case 'ADMIN_BACKUP_CREATE':
                  return `管理员手动创建了系统数据备份快照（文件名：${nd.filename || '--'}）`;

                case 'ADMIN_BACKUP_RESTORE':
                  return `管理员从备份文件【${nd.restoredFile || '--'}】还原了系统数据`;

                case 'ADMIN_DATABASE_IMPORT':
                case 'ADMIN_DB_IMPORT':
                  return `管理员导入了外部备份数据（共包含 ${nd.recordsCount ?? 0} 条击杀记录、${nd.usersCount ?? 0} 个用户账号）`;

                case 'ADMIN_DATABASE_RESET':
                case 'ADMIN_DB_RESET':
                  return `管理员执行了清空重置系统操作，所有频道已恢复为初始未记录状态`;

                default: {
                  if (nd.note) return String(nd.note);
                  if (l.old_data && l.new_data) {
                    return `变更前：${JSON.stringify(l.old_data)} → 变更后：${JSON.stringify(l.new_data)}`;
                  }
                  if (l.new_data) return JSON.stringify(l.new_data);
                  if (l.old_data) return JSON.stringify(l.old_data);
                  return '执行了系统操作';
                }
              }
            };

            const totalLogs = logs.length;
            const totalPages = logPageSize > 0 ? Math.max(1, Math.ceil(totalLogs / logPageSize)) : 1;
            const safePage = Math.min(logCurrentPage, totalPages);
            const displayedLogs =
              logPageSize > 0
                ? logs.slice((safePage - 1) * logPageSize, safePage * logPageSize)
                : logs;

            return (
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">全量操作审计日志</h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/70">
                        共 {totalLogs} 条记录
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      已将所有技术日志自动翻译为直观的中文说明，方便直接查看每次操作的具体内容。
                    </p>
                  </div>

                  {/* Filters Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={logSearchAction}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLogSearchAction(val);
                        loadLogs({ action: val });
                      }}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="">全部操作类型</option>
                      <option value="KILL_RECORD">全部击杀相关 (登记/补录/改/撤)</option>
                      <option value="KILL_RECORD_CREATE">击杀登记</option>
                      <option value="KILL_RECORD_BACKFILL">手动补录</option>
                      <option value="KILL_RECORD_EDIT">修改记录</option>
                      <option value="KILL_RECORD_VOID">撤销记录</option>
                      <option value="CHANNEL_VISIT">频道接单</option>
                      <option value="CHANNEL_LEAVE">频道退单</option>
                      <option value="CHANNEL_RESET">重置频道</option>
                      <option value="CHANNEL_TAG_UPDATE">频道标签</option>
                      <option value="USER_LOGIN">用户登录</option>
                      <option value="ADMIN_">管理员操作</option>
                    </select>

                    <select
                      value={logSearchChannel}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLogSearchChannel(val);
                        loadLogs({ channel: val });
                      }}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="">全部频道</option>
                      {Array.from({ length: 60 }, (_, i) => i + 1).map((ch) => (
                        <option key={ch} value={String(ch)}>
                          {ch} 频道
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={logSearchUser}
                      onChange={(e) => setLogSearchUser(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadLogs();
                      }}
                      placeholder="按账号 / 角色名搜索..."
                      className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-40"
                    />

                    <button
                      type="button"
                      onClick={() => loadLogs()}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      查询
                    </button>

                    {(logSearchAction || logSearchUser || logSearchChannel) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogSearchAction('');
                          setLogSearchUser('');
                          setLogSearchChannel('');
                          loadLogs({ action: '', user: '', channel: '' });
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        重置
                      </button>
                    )}
                  </div>
                </div>

                {/* Pagination & Page Size Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 px-1">
                  <div className="flex items-center gap-2">
                    <span>显示范围：</span>
                    <select
                      value={logPageSize}
                      onChange={(e) => {
                        setLogPageSize(parseInt(e.target.value, 10));
                        setLogCurrentPage(1);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value={100}>每页 100 条</option>
                      <option value={200}>每页 200 条</option>
                      <option value={500}>每页 500 条</option>
                      <option value={0}>不分页（一次显示全部 {totalLogs} 条）</option>
                    </select>
                    <span className="text-slate-500">
                      当前显示 <strong className="text-slate-200 font-mono">{displayedLogs.length}</strong> 条
                    </span>
                  </div>

                  {logPageSize > 0 && totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setLogCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        上一页
                      </button>
                      <span className="font-mono text-slate-300">
                        第 <strong>{safePage}</strong> / {totalPages} 页
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setLogCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        下一页
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs">
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">时间 (北京时间)</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">操作账号</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">频道</th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">操作类型</th>
                        <th className="py-2.5 px-3 font-semibold">操作详情说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/30 text-xs">
                      {displayedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-500">
                            暂无匹配的操作审计日志记录
                          </td>
                        </tr>
                      ) : (
                        displayedLogs.map((l) => {
                          const cnLabel = ACTION_LABELS[l.action] || l.action;
                          const friendlyText = translateLogDetail(l);

                          return (
                            <tr key={l.id} className="hover:bg-slate-900/60 align-top">
                              <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                                {formatBeijing(l.created_at)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-cyan-300 whitespace-nowrap">
                                {l.username}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                                {l.channel_no ? `${l.channel_no}频道` : '--'}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/60 font-bold text-purple-300 text-[11px]">
                                  {cnLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-200 break-words leading-relaxed">
                                {friendlyText}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* TAB 4: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Reset to Clean State */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>清空重置为全新纯净状态</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    清空所有频道的历史击杀记录、蹲守访问状态及备注，重置全部 60 个频道为“未记录”初始状态。
                  </p>
                </div>
                <button
                  onClick={handleResetDatabase}
                  className="px-4 py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold rounded-lg shrink-0 transition-colors"
                >
                  清空并重置系统
                </button>
              </div>

              {/* Manual snapshot & Export */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Archive className="w-4 h-4 text-cyan-400" />
                    <span>系统即时快照备份</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    保存当前全部 60 个频道的击杀历史、用户列表、访问状态及系统配置。
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateBackup}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>立即创建快照</span>
                    </button>
                    <a
                      href={api.exportDatabaseUrl()}
                      download
                      className="px-3.5 py-2 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded-lg font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>导出 JSON 文件</span>
                    </a>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>导入与恢复 JSON 备份</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    粘贴历史备份 JSON 文本覆盖还原数据库（导入前会自动生成安全快照）。
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="粘贴备份 JSON 字符串..."
                      value={importJsonText}
                      onChange={(e) => setImportJsonText(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 text-xs"
                    />
                    <button
                      onClick={handleImportJson}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold"
                    >
                      导入还原
                    </button>
                  </div>
                </div>
              </div>

              {/* Snapshots list */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white">系统备份文件列表 ({backups.length}份)</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                        <th className="py-2 px-3 font-semibold">备份文件名</th>
                        <th className="py-2 px-3 font-semibold">创建时间</th>
                        <th className="py-2 px-3 font-semibold">文件大小</th>
                        <th className="py-2 px-3 font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/30 text-[11px]">
                      {backups.map((b) => (
                        <tr key={b.name} className="hover:bg-slate-900/60">
                          <td className="py-2 px-3 font-mono font-medium text-slate-200">
                            {b.name}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {formatBeijing(b.created_at)}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {(b.size / 1024).toFixed(1)} KB
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleRestoreBackup(b.name)}
                              className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded font-semibold"
                            >
                              从该备份还原
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            关闭管理面板
          </button>
        </div>
      </div>
    </div>
  );
};
