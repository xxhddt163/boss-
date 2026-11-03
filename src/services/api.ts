import { User, BossConfig, ChannelComputedView, KillRecord, OperationLog, SystemSettings } from '../types.ts';

const TOKEN_KEY = 'snowman_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `请求失败 (${response.status})`);
    }
    return data as T;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败 (${response.status})`);
  }

  return (await response.text()) as unknown as T;
}

export const api = {
  // Auth
  getCaptcha: () => request<{ captchaId: string; code: string }>('/api/auth/captcha'),
  register: (body: any) => request<{ success: boolean; message: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  login: (body: any) => request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  getCurrentUser: () => request<{ user: User }>('/api/auth/me'),
  changePassword: (body: any) => request<{ success: boolean; message: string }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  }),

  // Channels
  getChannels: () => request<{
    serverTime: string;
    boss: BossConfig;
    settings: SystemSettings;
    channels: ChannelComputedView[];
  }>('/api/channels'),

  visitChannel: (channelNo: number) => request<{
    success: boolean;
    channel: ChannelComputedView;
    leftOtherChannel: number | null;
  }>(`/api/channels/${channelNo}/visit`, { method: 'POST' }),

  leaveChannel: (channelNo: number) => request<{ success: boolean }>(`/api/channels/${channelNo}/leave`, {
    method: 'POST',
  }),

  recordKill: (channelNo: number, kill_note?: string) => request<{
    success: boolean;
    isConcurrentUpdate: boolean;
    record: KillRecord;
    channel: ChannelComputedView;
    message: string;
  }>(`/api/channels/${channelNo}/kill`, {
    method: 'POST',
    body: JSON.stringify({ kill_note }),
  }),

  getChannelHistory: (channelNo: number) => request<{
    channelNo: number;
    channelNote: string;
    records: KillRecord[];
  }>(`/api/channels/${channelNo}/history`),

  backfillKill: (channelNo: number, body: { killed_at: string; game_id?: string; kill_note?: string }) =>
    request<{ success: boolean; record: KillRecord }>(`/api/channels/${channelNo}/backfill`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  editKillRecord: (channelNo: number, recordId: string, body: { killed_at?: string; game_id?: string; kill_note?: string }) =>
    request<{ success: boolean; record: KillRecord }>(`/api/channels/${channelNo}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  voidKillRecord: (channelNo: number, recordId: string, void_reason: string) =>
    request<{ success: boolean; record: KillRecord }>(`/api/channels/${channelNo}/records/${recordId}/void`, {
      method: 'POST',
      body: JSON.stringify({ void_reason }),
    }),

  restoreKillRecord: (channelNo: number, recordId: string) =>
    request<{ success: boolean; record: KillRecord }>(`/api/channels/${channelNo}/records/${recordId}/restore`, {
      method: 'POST',
    }),

  updateChannelNote: (channelNo: number, channel_note: string) =>
    request<{ success: boolean; channel: any }>(`/api/channels/${channelNo}/note`, {
      method: 'PUT',
      body: JSON.stringify({ channel_note }),
    }),

  updateChannelTag: (channelNo: number, channel_tag: string) =>
    request<{ success: boolean; channel_tag: string }>(`/api/channels/${channelNo}/tag`, {
      method: 'PUT',
      body: JSON.stringify({ channel_tag }),
    }),

  // Admin
  getUsers: () => request<{ users: User[] }>('/api/admin/users'),
  setUserStatus: (userId: string, status: 'active' | 'disabled' | 'pending') =>
    request<{ success: boolean; user: User }>(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  updateUserProfile: (userId: string, body: any) =>
    request<{ success: boolean; user: User }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  updateBossConfig: (body: any) =>
    request<{ success: boolean; boss: BossConfig }>('/api/admin/boss', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getAuditLogs: (params?: { action?: string; username?: string; channel_no?: number }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set('action', params.action);
    if (params?.username) q.set('username', params.username);
    if (params?.channel_no) q.set('channel_no', String(params.channel_no));
    return request<{ logs: OperationLog[] }>(`/api/admin/logs?${q.toString()}`);
  },
  updateSettings: (body: any) =>
    request<{ success: boolean; settings: SystemSettings }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  exportDatabaseUrl: () => '/api/admin/export',
  importDatabase: (data: any) =>
    request<{ success: boolean; message: string }>('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
  getBackups: () => request<{ backups: { name: string; size: number; created_at: string }[] }>('/api/admin/backups'),
  createBackup: () => request<{ success: boolean; filename: string }>('/api/admin/backups/create', { method: 'POST' }),
  restoreBackup: (filename: string) =>
    request<{ success: boolean; message: string }>('/api/admin/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),
  resetDatabase: () => request<{ success: boolean; message: string }>('/api/admin/reset-database', { method: 'POST' }),
};
