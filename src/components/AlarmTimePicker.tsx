import React, { useState, useEffect } from 'react';
import { getCurrentServerTime } from '../utils/time.ts';
import { Clock, Calendar, Zap, ChevronUp, ChevronDown } from 'lucide-react';

interface AlarmTimePickerProps {
  valueIso: string;
  onChangeIso: (isoString: string) => void;
  label?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_PRESETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const AlarmTimePicker: React.FC<AlarmTimePickerProps> = ({
  valueIso,
  onChangeIso,
  label = '击杀时间选择',
}) => {
  // Parse incoming value or default to current server time
  const getInitialDate = () => {
    if (valueIso) {
      const d = new Date(valueIso);
      if (!isNaN(d.getTime())) return d;
    }
    return getCurrentServerTime();
  };

  const initial = getInitialDate();

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYmd = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const [dateStr, setDateStr] = useState<string>(formatYmd(initial));
  const [selectedHour, setSelectedHour] = useState<number>(initial.getHours());
  const [selectedMinute, setSelectedMinute] = useState<number>(initial.getMinutes());
  const [selectedSecond, setSelectedSecond] = useState<number>(0);

  // Sync internal state when valueIso changes from outside
  useEffect(() => {
    if (valueIso) {
      const d = new Date(valueIso);
      if (!isNaN(d.getTime())) {
        setDateStr(formatYmd(d));
        setSelectedHour(d.getHours());
        setSelectedMinute(d.getMinutes());
        setSelectedSecond(d.getSeconds());
      }
    }
  }, [valueIso]);

  // Emit updated ISO string whenever date/hour/minute/second change
  const emitChange = (yDate: string, h: number, m: number, s: number = 0) => {
    const [year, month, day] = yDate.split('-').map(Number);
    const d = new Date();
    d.setFullYear(year, month - 1, day);
    d.setHours(h, m, s, 0);
    onChangeIso(d.toISOString());
  };

  const handleSelectHour = (h: number) => {
    setSelectedHour(h);
    emitChange(dateStr, h, selectedMinute, selectedSecond);
  };

  const handleSelectMinute = (m: number) => {
    setSelectedMinute(m);
    emitChange(dateStr, selectedHour, m, selectedSecond);
  };

  const handleDateChange = (newDate: string) => {
    setDateStr(newDate);
    emitChange(newDate, selectedHour, selectedMinute, selectedSecond);
  };

  const adjustMinute = (delta: number) => {
    let next = selectedMinute + delta;
    let nextHour = selectedHour;
    if (next >= 60) {
      next = next % 60;
      nextHour = (nextHour + 1) % 24;
    } else if (next < 0) {
      next = 60 + (next % 60);
      nextHour = (nextHour - 1 + 24) % 24;
    }
    setSelectedHour(nextHour);
    setSelectedMinute(next);
    emitChange(dateStr, nextHour, next, selectedSecond);
  };

  const applyOffsetMinutes = (offsetMinutes: number) => {
    const base = getCurrentServerTime();
    const target = new Date(base.getTime() + offsetMinutes * 60 * 1000);
    const ymd = formatYmd(target);
    setDateStr(ymd);
    setSelectedHour(target.getHours());
    setSelectedMinute(target.getMinutes());
    setSelectedSecond(0);
    emitChange(ymd, target.getHours(), target.getMinutes(), 0);
  };

  // Previews
  const entryPreview = `${pad((selectedHour + 1) % 24)}:${pad(selectedMinute)}:${pad(selectedSecond)}`;
  const guaranteedTotalMin = selectedHour * 60 + selectedMinute + 90;
  const guaranteedH = Math.floor(guaranteedTotalMin / 60) % 24;
  const guaranteedM = guaranteedTotalMin % 60;
  const guaranteedPreview = `${pad(guaranteedH)}:${pad(guaranteedM)}:${pad(selectedSecond)}`;

  return (
    <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 space-y-3.5 text-xs">
      {/* Top Header & Date Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-white text-xs">{label}</span>
        </div>

        {/* Date Selector (Auto-generated today, editable) */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={dateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono font-semibold focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Quick Offset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-slate-400 flex items-center gap-1 shrink-0">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>快捷时间：</span>
        </span>
        <button
          type="button"
          onClick={() => applyOffsetMinutes(0)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium transition-colors"
        >
          现在
        </button>
        <button
          type="button"
          onClick={() => applyOffsetMinutes(-5)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          5分钟前
        </button>
        <button
          type="button"
          onClick={() => applyOffsetMinutes(-10)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          10分钟前
        </button>
        <button
          type="button"
          onClick={() => applyOffsetMinutes(-30)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          30分钟前
        </button>
        <button
          type="button"
          onClick={() => applyOffsetMinutes(-60)}
          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          1小时前
        </button>
      </div>

      {/* Time Display & Minute Micro Stepper */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">当前选定击杀时间:</span>
          <span className="font-mono text-lg font-black text-cyan-400 tracking-wider">
            {dateStr} {pad(selectedHour)}:{pad(selectedMinute)}:{pad(selectedSecond)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustMinute(-1)}
            title="分 -1"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-700 font-bold text-white text-xs">
            {pad(selectedMinute)}分
          </span>
          <button
            type="button"
            onClick={() => adjustMinute(1)}
            title="分 +1"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Alarm Table Grid 1: Hours (00 - 23) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>点击选择小时 (00 ~ 23 时)</span>
          <span className="text-cyan-400 font-mono font-bold">{pad(selectedHour)} 时</span>
        </div>
        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => handleSelectHour(h)}
              className={`py-1.5 rounded-md font-mono text-xs font-bold transition-all ${
                selectedHour === h
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 scale-105'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {pad(h)}
            </button>
          ))}
        </div>
      </div>

      {/* Alarm Table Grid 2: Minutes (00 - 55 in steps of 5) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>点击选择分钟 (00 ~ 55 分)</span>
          <span className="text-purple-400 font-mono font-bold">{pad(selectedMinute)} 分</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MINUTE_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleSelectMinute(m)}
              className={`py-1.5 rounded-md font-mono text-xs font-bold transition-all ${
                selectedMinute === m
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30 scale-105'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {pad(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Automatic Calculation Preview Strip */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
        <div className="p-2 rounded-lg bg-sky-950/40 border border-sky-900/60 flex items-center justify-between">
          <span className="text-sky-300">自动进刷时间 (+60m):</span>
          <span className="font-mono font-bold text-sky-400 text-xs">{entryPreview}</span>
        </div>
        <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-center justify-between">
          <span className="text-rose-300">自动保底时间 (+90m):</span>
          <span className="font-mono font-bold text-rose-400 text-xs">{guaranteedPreview}</span>
        </div>
      </div>
    </div>
  );
};
