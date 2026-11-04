import React, { useState, useEffect, useRef } from 'react';
import { getCurrentServerTime } from '../utils/time.ts';
import { Calendar, Clock, X, RotateCcw, Sparkles } from 'lucide-react';

interface WheelTimePickerModalProps {
  isOpen: boolean;
  valueDate: Date;
  onClose: () => void;
  onConfirm: (newDate: Date) => void;
}

const ITEM_HEIGHT = 42; // px per item
const VISIBLE_COUNT = 5; // 5 visible rows (2 above, 1 selected, 2 below)
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 210px
const PADDING_TOP = ITEM_HEIGHT * 2; // 84px offset to center the active item

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i); // e.g. 2023, 2024, 2025, 2026, 2027, 2028
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1); // 1 to 12
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0 to 59
const SECONDS = Array.from({ length: 60 }, (_, i) => i); // 0 to 59

const pad = (n: number) => String(n).padStart(2, '0');

interface ColumnProps {
  items: number[];
  unit: string;
  selectedValue: number;
  onSelect: (value: number) => void;
  hasBorderRight?: boolean;
  isSpecialDivider?: boolean;
}

const WheelColumn: React.FC<ColumnProps> = ({
  items,
  unit,
  selectedValue,
  onSelect,
  hasBorderRight = false,
  isSpecialDivider = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const selectedIndex = Math.max(0, items.indexOf(selectedValue));

  // Scroll to active index on mount or when index changes externally
  useEffect(() => {
    if (containerRef.current) {
      isProgrammaticScroll.current = true;
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 50);
    }
  }, [selectedIndex]);

  // Handle scroll events
  const handleScroll = () => {
    if (isProgrammaticScroll.current || !containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    const targetValue = items[clampedIndex];
    if (targetValue !== selectedValue) {
      onSelect(targetValue);
    }
  };

  const handleClickItem = (val: number, idx: number) => {
    onSelect(val);
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: idx * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div
      className={`relative flex-1 h-[210px] select-none ${
        isSpecialDivider
          ? 'border-r-2 border-cyan-800/60'
          : hasBorderRight
          ? 'border-r border-slate-800/80'
          : ''
      }`}
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto no-scrollbar scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Top spacer so index 0 lands in the center highlight */}
        <div style={{ height: `${PADDING_TOP}px` }} />

        {items.map((val, idx) => {
          const isSelected = val === selectedValue;
          const dist = Math.abs(idx - selectedIndex);
          return (
            <div
              key={val}
              onClick={() => handleClickItem(val, idx)}
              style={{ height: `${ITEM_HEIGHT}px` }}
              className={`flex items-center justify-center cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'text-cyan-300 font-extrabold text-base scale-105'
                  : dist === 1
                  ? 'text-slate-400 text-xs sm:text-sm hover:text-slate-200'
                  : 'text-slate-600 text-[11px] sm:text-xs hover:text-slate-400'
              }`}
            >
              <span className="font-mono tabular-nums">
                {unit === '年' ? val : pad(val)}
              </span>
              <span className="text-[10px] ml-0.5 font-sans font-medium text-slate-400">
                {unit}
              </span>
            </div>
          );
        })}

        {/* Bottom spacer so last index lands in the center highlight */}
        <div style={{ height: `${PADDING_TOP}px` }} />
      </div>
    </div>
  );
};

export const WheelTimePickerModal: React.FC<WheelTimePickerModalProps> = ({
  isOpen,
  valueDate,
  onClose,
  onConfirm,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedSecond, setSelectedSecond] = useState<number>(0);

  // Tab mode: 'all' (both Date & Time), 'date' (only Year Month Day), 'time' (only Hour Min Sec)
  const [viewTab, setViewTab] = useState<'all' | 'date' | 'time'>('all');

  // Compute days in current month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const d = valueDate || getCurrentServerTime();
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth() + 1);
      setSelectedDay(d.getDate());
      setSelectedHour(d.getHours());
      setSelectedMinute(d.getMinutes());
      setSelectedSecond(d.getSeconds());
    }
  }, [isOpen, valueDate]);

  // Clamp day if month changes and day exceeds max
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedYear, selectedMonth, daysInMonth]);

  if (!isOpen) return null;

  const handleSetNow = () => {
    const now = getCurrentServerTime();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
    setSelectedDay(now.getDate());
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
    setSelectedSecond(now.getSeconds());
  };

  const handleSetToday = () => {
    const now = getCurrentServerTime();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
    setSelectedDay(now.getDate());
  };

  const handleSetYesterday = () => {
    const now = getCurrentServerTime();
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setSelectedYear(yest.getFullYear());
    setSelectedMonth(yest.getMonth() + 1);
    setSelectedDay(yest.getDate());
  };

  const handleConfirm = () => {
    const d = new Date();
    d.setFullYear(selectedYear, selectedMonth - 1, selectedDay);
    d.setHours(selectedHour, selectedMinute, selectedSecond, 0);
    onConfirm(d);
    onClose();
  };

  const datePreview = `${selectedYear}-${pad(selectedMonth)}-${pad(selectedDay)}`;
  const timePreview = `${pad(selectedHour)}:${pad(selectedMinute)}:${pad(selectedSecond)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Outer Card themed to match the website's dark slate & cyan aesthetic */}
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-700/80 animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header: Title and Preview */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              选择击杀时间（年月日 · 时分秒）
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Box & Quick Presets */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between bg-slate-900 border border-cyan-900/60 rounded-xl px-3.5 py-2">
            <span className="text-xs text-slate-400 font-medium">当前所选时间</span>
            <div className="flex items-center gap-2 font-mono font-bold text-base text-cyan-300">
              <span>{datePreview}</span>
              <span className="text-amber-400">{timePreview}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            {/* Quick date shortcuts */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetNow}
                className="px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/60 transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>设为此时</span>
              </button>
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                今日
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                昨日
              </button>
            </div>

            {/* View Tab Switcher */}
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setViewTab('all')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  viewTab === 'all'
                    ? 'bg-cyan-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                全部滚轮
              </button>
              <button
                type="button"
                onClick={() => setViewTab('date')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  viewTab === 'date'
                    ? 'bg-cyan-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                仅日期
              </button>
              <button
                type="button"
                onClick={() => setViewTab('time')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  viewTab === 'time'
                    ? 'bg-cyan-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                仅时间
              </button>
            </div>
          </div>
        </div>

        {/* Column Headers */}
        <div className="flex px-3 pt-2 pb-1 bg-slate-900 border-b border-slate-800/80 text-[11px] font-bold">
          {(viewTab === 'all' || viewTab === 'date') && (
            <div className={`flex items-center justify-around ${viewTab === 'all' ? 'w-1/2 border-r-2 border-cyan-800/60' : 'w-full'}`}>
              <span className="text-slate-400">年份</span>
              <span className="text-slate-400">月份</span>
              <span className="text-slate-400">日期</span>
            </div>
          )}
          {(viewTab === 'all' || viewTab === 'time') && (
            <div className={`flex items-center justify-around ${viewTab === 'all' ? 'w-1/2' : 'w-full'}`}>
              <span className="text-slate-400">时</span>
              <span className="text-slate-400">分</span>
              <span className="text-slate-400">秒</span>
            </div>
          )}
        </div>

        {/* Wheel Columns Section */}
        <div className="relative bg-slate-900/90 py-2">
          {/* Middle Highlight Bar */}
          <div
            className="absolute left-2 right-2 bg-cyan-950/60 border-y border-cyan-500/50 shadow-inner rounded-lg pointer-events-none"
            style={{
              top: `${PADDING_TOP + 8}px`,
              height: `${ITEM_HEIGHT}px`,
            }}
          />

          <div className="flex relative z-10 px-2">
            {/* Date Columns: Year, Month, Day */}
            {(viewTab === 'all' || viewTab === 'date') && (
              <>
                <WheelColumn
                  items={YEARS}
                  unit="年"
                  selectedValue={selectedYear}
                  onSelect={setSelectedYear}
                  hasBorderRight
                />
                <WheelColumn
                  items={MONTHS}
                  unit="月"
                  selectedValue={selectedMonth}
                  onSelect={setSelectedMonth}
                  hasBorderRight
                />
                <WheelColumn
                  items={DAYS}
                  unit="日"
                  selectedValue={selectedDay}
                  onSelect={setSelectedDay}
                  isSpecialDivider={viewTab === 'all'}
                  hasBorderRight={viewTab === 'date'}
                />
              </>
            )}

            {/* Time Columns: Hour, Minute, Second */}
            {(viewTab === 'all' || viewTab === 'time') && (
              <>
                <WheelColumn
                  items={HOURS}
                  unit="时"
                  selectedValue={selectedHour}
                  onSelect={setSelectedHour}
                  hasBorderRight
                />
                <WheelColumn
                  items={MINUTES}
                  unit="分"
                  selectedValue={selectedMinute}
                  onSelect={setSelectedMinute}
                  hasBorderRight
                />
                <WheelColumn
                  items={SECONDS}
                  unit="秒"
                  selectedValue={selectedSecond}
                  onSelect={setSelectedSecond}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-cyan-950/50 cursor-pointer text-center"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
