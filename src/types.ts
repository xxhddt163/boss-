export type UserRole = 'admin' | 'player';
export type UserStatus = 'pending' | 'active' | 'disabled';

export interface User {
  id: string;
  username: string;
  nickname: string;
  game_id: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  must_change_password?: boolean;
  created_at?: string;
  last_login_at?: string;
}

export interface BossConfig {
  id: string;
  boss_name: string;
  entry_interval: number;
  guaranteed_interval: number;
  enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export interface KillRecord {
  id: string;
  channel_no: number;
  boss_name: string;
  killed_at: string;
  entry_at: string;
  guaranteed_at: string;
  game_id: string;
  kill_note: string;
  created_by: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  is_void: boolean;
  voided_by?: string;
  voided_at?: string;
  void_reason?: string;
}

export interface ChannelComputedView {
  channel_no: number;
  channel_note: string;
  status: 'unrecorded' | 'waiting_entry' | 'in_spawn_window' | 'guaranteed_reached';
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
  timezone: string;
  reminder_before: number;
  sound_enabled: boolean;
  notification_enabled: boolean;
  updated_at: string;
  updated_by: string;
}
