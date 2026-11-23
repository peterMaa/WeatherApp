import { Bookmark, BookmarkCheck, Compass, MapPin } from 'lucide-react';
import type { AlertRuleConfig, GridCellForecast } from '../types/weather';
import { evaluateAlertSeverity, getSeverityMeta } from '../utils/weatherGrid';

interface CellInspectorPanelProps {
  cell: GridCellForecast;
  hourIndex: number;
  alertRules: AlertRuleConfig;
  isWatched: boolean;
  onToggleWatch: (cellId: string) => void;
  onChangeHour: (hour: number) => void;
  onOpenGroundingForCell: () => void;
}

export function CellInspectorPanel({
  cell,
  hourIndex,
  alertRules,
  isWatched,
  onToggleWatch,
  onChangeHour,
  onOpenGroundingForCell,
}: CellInspectorPanelProps) {
  const current = cell.hourly[hourIndex] ?? cell.hourly[0];
  const severity = evaluateAlertSeverity(current, alertRules);
  const sevMeta = getSeverityMeta(severity);

  // Compute cell's 48h peak
  let cellPeakProb = 0;
  let cellPeakHour = 0;
  let cellTotalRain = 0;
  for (const pt of cell.hourly) {
    cellTotalRain += pt.rainMm;
    if (pt.precipProb > cellPeakProb) {
      cellPeakProb = pt.precipProb;
      cellPeakHour = pt.hourIndex;
    }
  }

  // SVG 48h Curve geometry
  const svgW = 360;
  const svgH = 128;
  const padL = 26;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const xForHour = (h: number) => padL + (h / 47) * plotW;
  const yForProb = (p: number) => padT + ((100 - Math.max(0, Math.min(100, p))) / 100) * plotH;

  const probLinePath = cell.hourly
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xForHour(pt.hourIndex).toFixed(1)} ${yForProb(pt.precipProb).toFixed(1)}`)
    .join(' ');

  const probAreaPath = `${probLinePath} L ${xForHour(47).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xForHour(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const maxRainScale = Math.max(10, ...cell.hourly.map((h) => h.rainMm));

  return (
    <aside
      aria-label="选中格网气象详情"
      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4"
    >
      {/* Cell Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
            <span className="whitespace-nowrap">{cell.regionZh}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums whitespace-nowrap">{cell.code}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              {cell.center.lat.toFixed(3)}°N, {cell.center.lng.toFixed(3)}°E
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900 truncate">
            {cell.nameZh}
            <span className="ml-2 text-xs font-normal text-slate-500">{cell.nameEn}</span>
          </h2>
          <div className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold ${sevMeta.textClass}`}>
            <span aria-hidden="true">{sevMeta.symbol}</span>
            <span>{sevMeta.label}</span>
            <span className="text-slate-400 font-normal" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600 font-normal">{current.conditionZh}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleWatch(cell.id)}
          aria-pressed={isWatched}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isWatched
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {isWatched ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          <span>{isWatched ? '已关注' : '关注此区'}</span>
        </button>
      </div>

      {/* 6-Metric Precision Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="text-xs text-slate-500">当前降水概率</div>
          <div className="mt-1 flex items-baseline">
            <span className="text-2xl font-mono tabular-nums font-bold text-slate-900">
              {current.precipProb}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">%</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="text-xs text-slate-500">小时降水量 (QPF)</div>
          <div className="mt-1 flex items-baseline">
            <span className="text-2xl font-mono tabular-nums font-bold text-slate-900">
              {current.rainMm.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">mm/h</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="text-xs text-slate-500">雷暴伴随概率</div>
          <div className="mt-1 flex items-baseline">
            <span className="text-xl font-mono tabular-nums font-semibold text-slate-900">
              {current.thunderProb}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">%</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="text-xs text-slate-500">气温 / 体感</div>
          <div className="mt-1 flex items-baseline">
            <span className="text-xl font-mono tabular-nums font-semibold text-slate-900">
              {current.tempC.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-0.5">°C</span>
            <span className="text-xs font-mono tabular-nums text-slate-400 ml-1.5">
              /{current.feelsLikeC.toFixed(0)}°
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="text-xs text-slate-500">相对湿度</div>
          <div className="mt-1 flex items-baseline">
            <span className="text-xl font-mono tabular-nums font-semibold text-slate-900">
              {current.humidity}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">%</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
          <div className="text-xs text-slate-500">风速与风向</div>
          <div className="mt-1 flex items-baseline">
            <span className="text-xl font-mono tabular-nums font-semibold text-slate-900">
              {current.windKmh.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-slate-500 ml-1">
              km/h {current.windDirection}
            </span>
          </div>
        </div>
      </div>

      {/* 48h Local Curve */}
      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-800">本区域 48h 降水概率与雨量曲线</span>
          <span className="font-mono tabular-nums text-slate-500">
            峰值 {cellPeakProb}% (T+{cellPeakHour}h) · 累计 {cellTotalRain.toFixed(1)} mm
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-32 select-none"
          role="img"
          aria-label={`${cell.nameZh} 未来 48 小时降水概率趋势图`}
        >
          {/* Y-axis ticks */}
          {[0, 50, 100].map((val) => {
            const y = yForProb(val);
            return (
              <g key={val}>
                <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text
                  x={padL - 4}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Warning Threshold line */}
          <line
            x1={padL}
            y1={yForProb(alertRules.warningThreshold)}
            x2={svgW - padR}
            y2={yForProb(alertRules.warningThreshold)}
            stroke="#ea580c"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Rainfall mm/h vertical micro-bars */}
          {cell.hourly.map((pt) => {
            const barH = (pt.rainMm / maxRainScale) * plotH * 0.65;
            if (barH <= 0.5) return null;
            return (
              <rect
                key={`rain-${pt.hourIndex}`}
                x={xForHour(pt.hourIndex) - 2}
                y={padT + plotH - barH}
                width={4}
                height={barH}
                fill="#0284c7"
                fillOpacity={0.35}
              />
            );
          })}

          {/* Precip Probability Area + Line */}
          <path d={probAreaPath} fill="#2563eb" fillOpacity={0.1} />
          <path d={probLinePath} fill="none" stroke="#1d4ed8" strokeWidth="2" />

          {/* Active Hour Vertical Indicator */}
          <line
            x1={xForHour(hourIndex)}
            y1={padT}
            x2={xForHour(hourIndex)}
            y2={padT + plotH}
            stroke="#0f172a"
            strokeWidth="1.25"
          />
          <circle
            cx={xForHour(hourIndex)}
            cy={yForProb(current.precipProb)}
            r={3.5}
            fill="#1d4ed8"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          {/* Clickable hit columns */}
          {cell.hourly.map((pt) => (
            <rect
              key={`hit-${pt.hourIndex}`}
              x={xForHour(pt.hourIndex) - plotW / 96}
              y={padT}
              width={plotW / 47}
              height={plotH}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onChangeHour(pt.hourIndex)}
            />
          ))}

          {/* X-axis ticks */}
          {[0, 12, 24, 36, 47].map((h) => (
            <text
              key={`x-${h}`}
              x={xForHour(h)}
              y={svgH - 4}
              textAnchor={h === 0 ? 'start' : h === 47 ? 'end' : 'middle'}
              fill="#64748b"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              +{h}h
            </text>
          ))}
        </svg>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">结合 Google Maps 实景查询避雨地点</span>
        </div>
        <button
          type="button"
          onClick={onOpenGroundingForCell}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>周边防雨参谋</span>
        </button>
      </div>
    </aside>
  );
}
