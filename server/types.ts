export type UserRole = 'admin' | 'player';
export type UserStatus = 'pending' | 'active' | 'disabled';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  nickname: string;
  game_id: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  must_change_password?: boolean;
  created_at: string; // ISO UTC
  updated_at: string;
  last_login_at?: string;
  last_login_ip?: string;
  last_login_location?: string;
}

export interface BossConfig {
  id: string;
  boss_name: string;
  entry_interval: number; // minutes, default 60
  guaranteed_interval: number; // minutes, default 90
  enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export interface Channel {
  id: string;
  channel_no: number; // 1 ~ 60
  boss_id: string;
  channel_note: string; // Long-term note
  channel_tag?: string; // Tag: 护食 / 不抢怪 / 龙骑很强
  reset_at?: string; // ISO UTC - when channel timing was reset to empty
  version: number;
  updated_at: string;
  updated_by: string;
}

export interface KillRecord {
  id: string;
  channel_no: number;
  boss_name: string;
  killed_at: string; // ISO UTC
  entry_at: string; // ISO UTC
  guaranteed_at: string; // ISO UTC
  game_id: string;
  kill_note: string;
  created_by: string; // username
  created_by_user_id: string;
  created_at: string; // ISO UTC
  updated_at: string;
  updated_by?: string;
  is_void: boolean;
  voided_by?: string;
  voided_at?: string;
  void_reason?: string;
}

export interface ChannelVisit {
  id: string;
  channel_no: number;
  user_id: string;
  game_id: string;
  username: string;
  joined_at: string;
  last_heartbeat_at: string;
  left_at?: string;
  leave_reason?: string;
  status: 'active' | 'left' | 'expired';
}

export interface OperationLog {
  id: string;
  user_id: string;
  username: string;
  channel_no?: number;
  record_id?: string;
  action: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
  request_id: string;
}

export interface SystemSettings {
  timezone: string; // 'Asia/Shanghai'
  reminder_before: number; // minutes, default 5
  sound_enabled: boolean;
  notification_enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export type ChannelStatus = 'unrecorded' | 'waiting_entry' | 'in_spawn_window' | 'guaranteed_reached';

export interface ChannelComputedView {
  channel_no: number;
  channel_note: string;
  channel_tag?: string;
  status: ChannelStatus;
  status_label: string;
  last_kill: KillRecord | null;
  killed_at_display: string;
  entry_at_display: string;
  guaranteed_at_display: string;
  remaining_seconds_entry: number | null;
  remaining_seconds_guaranteed: number | null;
  overdue_seconds_guaranteed: number | null;
  active_visitors: {
    user_id: string;
    game_id: string;
    username: string;
    joined_at: string;
  }[];
  version: number;
  updated_at: string;
}

export interface DBState {
  users: User[];
  boss: BossConfig;
  channels: Channel[];
  kill_records: KillRecord[];
  channel_visits: ChannelVisit[];
  operation_logs: OperationLog[];
  settings: SystemSettings;
}
