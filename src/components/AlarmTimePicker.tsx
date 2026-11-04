import React, { useState } from 'react';
import { WheelTimePickerModal } from './WheelTimePickerModal.tsx';
import { ChevronRight } from 'lucide-react';

interface AlarmTimePickerProps {
  valueIso: string;
  onChangeIso: (isoString: string) => void;
  label?: string;
}

export const AlarmTimePicker: React.FC<AlarmTimePickerProps> = ({
  valueIso,
  onChangeIso,
  label = '击杀时间',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pad = (n: number) => String(n).padStart(2, '0');

  const date = valueIso ? new Date(valueIso) : new Date();
  const timeDisplay = isNaN(date.getTime())
    ? '--:--:--'
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  return (
    <div className="space-y-1">
      <div
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500 cursor-pointer transition-colors group"
      >
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold font-mono text-cyan-300">{timeDisplay}</span>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      <WheelTimePickerModal
        isOpen={isOpen}
        valueDate={isNaN(date.getTime()) ? new Date() : date}
        onClose={() => setIsOpen(false)}
        onConfirm={(newDate) => {
          onChangeIso(newDate.toISOString());
        }}
      />
    </div>
  );
};
