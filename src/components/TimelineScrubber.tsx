import { Flame, Pause, Play } from 'lucide-react';
import type { AlertRuleConfig, GridCellForecast } from '../types/weather';

interface TimelineScrubberProps {
  cells: GridCellForecast[];
  hourIndex: number;
  isPlaying: boolean;
  alertRules: AlertRuleConfig;
  peakHourIndex: number;
  peakPrecipProb: number;
  onChangeHour: (hour: number) => void;
  onTogglePlay: () => void;
  onJumpToPeak: () => void;
}

const QUICK_OFFSETS = [0, 6, 12, 24, 36, 47];

export function TimelineScrubber({
  cells,
  hourIndex,
  isPlaying,
  alertRules,
  peakHourIndex,
  peakPrecipProb,
  onChangeHour,
  onTogglePlay,
  onJumpToPeak,
}: TimelineScrubberProps) {
  const referenceHourly = cells[0]?.hourly ?? [];
  const currentSlot = referenceHourly[hourIndex];

  // Island-wide max precipitation probability per hour (0..47)
  const hourlyMaxSeries = referenceHourly.map((_, h) => {
    let maxP = 0;
    for (const cell of cells) {
      const p = cell.hourly[h]?.precipProb ?? 0;
      if (p > maxP) maxP = p;
    }
    return maxP;
  });

  return (
    <section
      aria-label="48 小时时间轴控制"
      className="bg-white border border-slate-200 rounded-xl p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? '暂停 48 小时演变播放' : '播放 48 小时降水演变'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? '暂停演变' : '播放 48h'}</span>
          </button>

          <div className="text-sm">
            <span className="font-semibold text-slate-900 font-mono tabular-nums">
              {currentSlot?.sgtLabel ?? '--'}
            </span>
            <span className="text-slate-400 mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-600 font-mono tabular-nums">
              T+{hourIndex}h (SGT UTC+8)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {QUICK_OFFSETS.map((offset) => (
              <button
                key={offset}
                type="button"
                onClick={() => onChangeHour(offset)}
                className={`px-2 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  hourIndex === offset
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {offset === 0 ? '现在' : `+${offset}h`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onJumpToPeak}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>
              定位峰值时段 (T+{peakHourIndex}h · {peakPrecipProb}%)
            </span>
          </button>
        </div>
      </div>

      {/* 48-hour island-wide max precipitation sparkline bar selector */}
      <div className="relative h-14 mb-2 flex items-end gap-[2px] pt-2">
        {/* Warning threshold reference line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-orange-500/80 z-10"
          style={{ bottom: `${Math.min(96, alertRules.warningThreshold)}%` }}
        >
          <span className="absolute right-0 -top-4 text-[10px] font-mono tabular-nums text-orange-700 bg-white/90 px-1">
            预警线 {alertRules.warningThreshold}%
          </span>
        </div>

        {hourlyMaxSeries.map((prob, h) => {
          const isCurrent = h === hourIndex;
          let barColor = 'bg-slate-300';
          if (prob >= alertRules.severeThreshold) barColor = 'bg-red-600';
          else if (prob >= alertRules.warningThreshold) barColor = 'bg-orange-500';
          else if (prob >= alertRules.watchThreshold) barColor = 'bg-blue-600';
          else if (prob >= 30) barColor = 'bg-sky-300';

          return (
            <button
              key={h}
              type="button"
              onClick={() => onChangeHour(h)}
              title={`T+${h}h (${referenceHourly[h]?.sgtLabel ?? ''}) 全岛最高降水概率 ${prob}%`}
              aria-label={`跳转至 T+${h} 小时，最高降水概率 ${prob}%`}
              className={`flex-1 h-full flex items-end group cursor-pointer focus:outline-none ${
                isCurrent ? 'bg-slate-900/10 rounded-t-xs' : ''
              }`}
            >
              <span
                className={`w-full rounded-t-[2px] transition-opacity ${barColor} ${
                  isCurrent ? 'ring-1 ring-slate-900 opacity-100' : 'opacity-80 group-hover:opacity-100'
                }`}
                style={{ height: `${Math.max(8, prob)}%` }}
              />
            </button>
          );
        })}
      </div>

      {/* Range Scrubber */}
      <div className="flex items-center gap-3">
        <label htmlFor="timeline-hour-range" className="sr-only">
          选择未来 48 小时预报时刻
        </label>
        <input
          id="timeline-hour-range"
          type="range"
          min={0}
          max={47}
          step={1}
          value={hourIndex}
          onChange={(e) => onChangeHour(Number(e.target.value))}
          className="meteo-slider w-full"
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
        <span>{referenceHourly[0]?.sgtLabel ?? '0h'}</span>
        <span>{referenceHourly[12]?.sgtLabel ?? '+12h'}</span>
        <span>{referenceHourly[24]?.sgtLabel ?? '+24h'}</span>
        <span>{referenceHourly[36]?.sgtLabel ?? '+36h'}</span>
        <span>{referenceHourly[47]?.sgtLabel ?? '+48h'}</span>
      </div>
    </section>
  );
}
