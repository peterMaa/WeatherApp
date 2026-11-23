import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type {
  AlertRuleConfig,
  GridCellForecast,
  SingaporeRegion,
  WeatherLayer,
} from '../types/weather';
import {
  REGION_LABELS_ZH,
  evaluateAlertSeverity,
  getLayerColorSpec,
} from '../utils/weatherGrid';

interface ForecastMatrixViewProps {
  cells: GridCellForecast[];
  hourIndex: number;
  selectedCellId: string;
  watchlistIds: string[];
  activeLayer: WeatherLayer;
  alertRules: AlertRuleConfig;
  onSelectLayer: (layer: WeatherLayer) => void;
  onSelectCellAndHour: (cellId: string, hour: number, switchToMap?: boolean) => void;
}

type RegionFilter = 'ALL' | 'WATCHLIST' | SingaporeRegion;

const REGION_FILTERS: Array<{ id: RegionFilter; label: string }> = [
  { id: 'ALL', label: '全岛 26 格网' },
  { id: 'WATCHLIST', label: '仅关注区域' },
  { id: 'Central', label: REGION_LABELS_ZH.Central },
  { id: 'North', label: REGION_LABELS_ZH.North },
  { id: 'North-East', label: REGION_LABELS_ZH['North-East'] },
  { id: 'East', label: REGION_LABELS_ZH.East },
  { id: 'West', label: REGION_LABELS_ZH.West },
];

export function ForecastMatrixView({
  cells,
  hourIndex,
  selectedCellId,
  watchlistIds,
  activeLayer,
  alertRules,
  onSelectLayer,
  onSelectCellAndHour,
}: ForecastMatrixViewProps) {
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stepHours, setStepHours] = useState<1 | 2 | 3>(2);

  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const filteredCells = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cells.filter((cell) => {
      if (regionFilter === 'WATCHLIST' && !watchlistSet.has(cell.id)) return false;
      if (regionFilter !== 'ALL' && regionFilter !== 'WATCHLIST' && cell.region !== regionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        cell.nameZh.toLowerCase().includes(q) ||
        cell.nameEn.toLowerCase().includes(q) ||
        cell.code.toLowerCase().includes(q) ||
        cell.regionZh.includes(q)
      );
    });
  }, [cells, regionFilter, searchQuery, watchlistSet]);

  const hourColumns = useMemo(() => {
    const cols: number[] = [];
    for (let h = 0; h < 48; h += stepHours) {
      cols.push(h);
    }
    return cols;
  }, [stepHours]);

  const referenceHourly = cells[0]?.hourly ?? [];

  return (
    <section
      aria-label="新加坡 48 小时时空预报矩阵"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Matrix Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">新加坡 48 小时区域 × 时段格网矩阵</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              点击任意时空单元格即可同步右侧详情或定位至地图对应时刻 · 预警线 ≥{alertRules.warningThreshold}%
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Step Resolution Switcher */}
            <div
              role="group"
              aria-label="矩阵时间步长"
              className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg"
            >
              {([1, 2, 3] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setStepHours(step)}
                  className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    stepHours === step
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  逐 {step}h
                </button>
              ))}
            </div>

            {/* Layer Switcher */}
            <div
              role="group"
              aria-label="矩阵指标切换"
              className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg"
            >
              {(
                [
                  { id: 'precipProb', label: '降水概率' },
                  { id: 'rainMm', label: '雨量' },
                  { id: 'tempC', label: '气温' },
                  { id: 'windKmh', label: '风速' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLayer(item.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeLayer === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Region Filter + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="区域筛选">
            {REGION_FILTERS.map((rf) => {
              const active = regionFilter === rf.id;
              return (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setRegionFilter(rf.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {rf.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="matrix-search-input" className="sr-only">
              搜索新加坡区域名称或格网编码
            </label>
            <input
              id="matrix-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索区域 (如 滨海湾 / Changi)"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Heatmap Data Grid Table */}
      {filteredCells.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">当前筛选条件下暂无匹配的新加坡气象格网</p>
          <button
            type="button"
            onClick={() => {
              setRegionFilter('ALL');
              setSearchQuery('');
            }}
            className="mt-3 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            重置区域筛选
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2.5 font-semibold text-slate-700 border-r border-slate-200 min-w-[164px]">
                  新加坡格网区域
                </th>
                {hourColumns.map((h) => {
                  const slot = referenceHourly[h];
                  const isCurrentCol = Math.abs(h - hourIndex) < stepHours && hourIndex >= h;
                  return (
                    <th
                      key={h}
                      className={`px-1.5 py-2 text-center font-mono tabular-nums border-r border-slate-100 min-w-[46px] ${
                        isCurrentCol ? 'bg-blue-50 text-blue-800 font-bold' : 'text-slate-600 font-medium'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 leading-none mb-0.5">
                        {slot?.dayLabel ?? ''}
                      </div>
                      <div>{slot?.shortHour ?? `+${h}h`}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCells.map((cell) => {
                const isSelectedRow = cell.id === selectedCellId;
                return (
                  <tr
                    key={cell.id}
                    className={isSelectedRow ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}
                  >
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 text-left px-3 py-2 border-r border-slate-200 font-normal ${
                        isSelectedRow ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {cell.nameZh}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {cell.regionZh} · <span className="font-mono">{cell.code}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectCellAndHour(cell.id, hourIndex, true)}
                          title={`在地图上查看 ${cell.nameZh}`}
                          aria-label={`在地图上定位 ${cell.nameZh}`}
                          className="p-1 text-slate-400 hover:text-blue-700 rounded cursor-pointer shrink-0"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>

                    {hourColumns.map((h) => {
                      const pt = cell.hourly[h] ?? cell.hourly[0];
                      const spec = getLayerColorSpec(pt, activeLayer);
                      const sev = evaluateAlertSeverity(pt, alertRules);
                      const isActiveTile = cell.id === selectedCellId && h === hourIndex;

                      return (
                        <td key={h} className="p-0.5 border-r border-slate-100 text-center">
                          <button
                            type="button"
                            onClick={() => onSelectCellAndHour(cell.id, h, false)}
                            title={`${cell.nameZh} · ${pt.sgtLabel} · 降水概率 ${pt.precipProb}% · 雨量 ${pt.rainMm}mm/h`}
                            aria-label={`${cell.nameZh} ${pt.sgtLabel} ${spec.formattedValue}`}
                            className={`w-full py-1.5 px-1 rounded-xs font-mono tabular-nums text-[11px] font-medium transition-transform cursor-pointer ${
                              spec.cellBgClass
                            } ${
                              isActiveTile
                                ? 'ring-2 ring-slate-900 ring-offset-1'
                                : sev === 'severe'
                                  ? 'ring-1 ring-inset ring-red-900/40'
                                  : ''
                            }`}
                          >
                            {spec.formattedValue}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
