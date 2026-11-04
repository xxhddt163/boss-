import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  getCurrentServerTime,
  getBeijingParts,
  createDateFromBeijingParts,
} from '../utils/time.ts';
import { Calendar, X, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';

interface WheelTimePickerModalProps {
  isOpen: boolean;
  valueDate?: Date | null;
  onClose: () => void;
  onConfirm: (newDate: Date) => void;
}

const ITEM_HEIGHT = 40; // px per item
const PADDING_TOP = ITEM_HEIGHT * 2; // 80px offset to center active item in 200px viewport

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
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  const selectedIndex = Math.max(0, items.indexOf(selectedValue));

  // Sync scroll position whenever selectedIndex changes externally
  useEffect(() => {
    if (containerRef.current) {
      isUserScrollingRef.current = false;
      containerRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex, items]);

  const handleUserInteract = () => {
    isUserScrollingRef.current = true;
  };

  const handleScroll = () => {
    if (!isUserScrollingRef.current || !containerRef.current) return;

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
      const targetValue = items[clampedIndex];
      if (targetValue !== undefined && targetValue !== selectedValue) {
        onSelect(targetValue);
      }
      isUserScrollingRef.current = false;
    }, 80);
  };

  const handleClickItem = (val: number, idx: number) => {
    isUserScrollingRef.current = false;
    onSelect(val);
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: idx * ITEM_HEIGHT,
        behavior: 'smooth',
      });
    }
  };

  const handleStep = (delta: number) => {
    const nextIdx = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
    handleClickItem(items[nextIdx], nextIdx);
  };

  return (
    <div
      className={`relative flex-1 h-[200px] select-none group flex flex-col ${
        isSpecialDivider
          ? 'border-r-2 border-cyan-800/80'
          : hasBorderRight
          ? 'border-r border-slate-800/80'
          : ''
      }`}
    >
      {/* Up Stepper Button */}
      <button
        type="button"
        onClick={() => handleStep(-1)}
        className="absolute top-0 inset-x-0 h-5 flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-950/40 z-20 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
        title="上一项"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>

      {/* Scrollable Column */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleUserInteract}
        onTouchStart={handleUserInteract}
        onMouseDown={handleUserInteract}
        className="h-full overflow-y-auto no-scrollbar scroll-smooth"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Top Spacer */}
        <div style={{ height: `${PADDING_TOP}px` }} />

        {items.map((val, idx) => {
          const isSelected = val === selectedValue;
          const dist = Math.abs(idx - selectedIndex);
          return (
            <div
              key={val}
              onClick={() => handleClickItem(val, idx)}
              style={{ height: `${ITEM_HEIGHT}px` }}
              className={`flex items-center justify-center cursor-pointer transition-all duration-100 ${
                isSelected
                  ? 'text-cyan-300 font-extrabold text-base scale-105'
                  : dist === 1
                  ? 'text-slate-400 text-xs sm:text-sm hover:text-slate-200'
                  : 'text-slate-600 text-[11px] hover:text-slate-400'
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

        {/* Bottom Spacer */}
        <div style={{ height: `${PADDING_TOP}px` }} />
      </div>

      {/* Down Stepper Button */}
      <button
        type="button"
        onClick={() => handleStep(1)}
        className="absolute bottom-0 inset-x-0 h-5 flex items-center justify-center text-slate-500 hover:text-cyan-300 hover:bg-cyan-950/40 z-20 transition-colors opacity-70 hover:opacity-100 cursor-pointer"
        title="下一项"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const WheelTimePickerModal: React.FC<WheelTimePickerModalProps> = ({
  isOpen,
  valueDate,
  onClose,
  onConfirm,
}) => {
  // Extract canonical Beijing Time parts
  const initialParts = useMemo(() => {
    return getBeijingParts(valueDate || getCurrentServerTime());
  }, [isOpen, valueDate]);

  const [selectedYear, setSelectedYear] = useState<number>(initialParts.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialParts.month);
  const [selectedDay, setSelectedDay] = useState<number>(initialParts.day);
  const [selectedHour, setSelectedHour] = useState<number>(initialParts.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(initialParts.minute);
  const [selectedSecond, setSelectedSecond] = useState<number>(initialParts.second);

  const [viewTab, setViewTab] = useState<'all' | 'date' | 'time'>('all');

  // Compute years around current Beijing year
  const YEARS = useMemo(() => {
    const base = initialParts.year;
    const list = [base - 2, base - 1, base, base + 1, base + 2];
    if (!list.includes(selectedYear)) {
      list.push(selectedYear);
      list.sort((a, b) => a - b);
    }
    return list;
  }, [initialParts.year, selectedYear]);

  const MONTHS = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const HOURS = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const MINUTES = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const SECONDS = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  // Compute actual days in selected year/month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const DAYS = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  // When modal opens or valueDate updates, reset to canonical Beijing parts
  useEffect(() => {
    if (isOpen) {
      const parts = getBeijingParts(valueDate || getCurrentServerTime());
      setSelectedYear(parts.year);
      setSelectedMonth(parts.month);
      setSelectedDay(parts.day);
      setSelectedHour(parts.hour);
      setSelectedMinute(parts.minute);
      setSelectedSecond(parts.second);
    }
  }, [isOpen, valueDate]);

  // Clamp day if month changes
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  if (!isOpen) return null;

  // 1. Reset strictly to current server Beijing time
  const handleSetNow = () => {
    const parts = getBeijingParts(getCurrentServerTime());
    setSelectedYear(parts.year);
    setSelectedMonth(parts.month);
    setSelectedDay(parts.day);
    setSelectedHour(parts.hour);
    setSelectedMinute(parts.minute);
    setSelectedSecond(parts.second);
  };

  // 2. Set date strictly to today in Beijing time
  const handleSetToday = () => {
    const parts = getBeijingParts(getCurrentServerTime());
    setSelectedYear(parts.year);
    setSelectedMonth(parts.month);
    setSelectedDay(parts.day);
  };

  // 3. Set date strictly to yesterday in Beijing time
  const handleSetYesterday = () => {
    const nowServer = getCurrentServerTime();
    const yestDate = new Date(nowServer.getTime() - 24 * 60 * 60 * 1000);
    const parts = getBeijingParts(yestDate);
    setSelectedYear(parts.year);
    setSelectedMonth(parts.month);
    setSelectedDay(parts.day);
  };

  const handleConfirm = () => {
    const finalDate = createDateFromBeijingParts(
      selectedYear,
      selectedMonth,
      selectedDay,
      selectedHour,
      selectedMinute,
      selectedSecond
    );
    onConfirm(finalDate);
    onClose();
  };

  const datePreview = `${selectedYear}-${pad(selectedMonth)}-${pad(selectedDay)}`;
  const timePreview = `${pad(selectedHour)}:${pad(selectedMinute)}:${pad(selectedSecond)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-700/80 animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              选择击杀时间（北京时间）
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview & Preset Buttons */}
        <div className="p-3.5 sm:p-4 bg-slate-950/60 border-b border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between bg-slate-900 border border-cyan-900/60 rounded-xl px-3.5 py-2">
            <span className="text-xs text-slate-400 font-medium">所选时间</span>
            <div className="flex items-center gap-2 font-mono font-bold text-sm sm:text-base text-cyan-300">
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
                className="px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-700/70 text-cyan-300 hover:bg-cyan-900/80 transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>设为此时</span>
              </button>
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                今日
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
                全部
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
                年月日
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
                时分秒
              </button>
            </div>
          </div>
        </div>

        {/* Column Headers */}
        <div className="flex px-2 pt-2 pb-1 bg-slate-900 border-b border-slate-800/80 text-[11px] font-bold text-center">
          {(viewTab === 'all' || viewTab === 'date') && (
            <div className={`flex items-center justify-around ${viewTab === 'all' ? 'w-1/2 border-r-2 border-cyan-800/80' : 'w-full'}`}>
              <span className="flex-1 text-slate-400">年</span>
              <span className="flex-1 text-slate-400">月</span>
              <span className="flex-1 text-slate-400">日</span>
            </div>
          )}
          {(viewTab === 'all' || viewTab === 'time') && (
            <div className={`flex items-center justify-around ${viewTab === 'all' ? 'w-1/2' : 'w-full'}`}>
              <span className="flex-1 text-slate-400">时</span>
              <span className="flex-1 text-slate-400">分</span>
              <span className="flex-1 text-slate-400">秒</span>
            </div>
          )}
        </div>

        {/* Wheel Viewport */}
        <div className="relative bg-slate-900/95 py-1">
          {/* Middle Selected Row Highlight */}
          <div
            className="absolute left-2 right-2 bg-cyan-950/70 border-y border-cyan-500/60 shadow-inner rounded-lg pointer-events-none z-10"
            style={{
              top: `${PADDING_TOP + 4}px`,
              height: `${ITEM_HEIGHT}px`,
            }}
          />

          <div className="flex relative px-2">
            {/* Date Columns */}
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

            {/* Time Columns */}
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

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-950/80 border-t border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
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
