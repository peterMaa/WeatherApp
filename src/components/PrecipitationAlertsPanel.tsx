import { CheckCircle2, ExternalLink, MapPin, RotateCcw, ShieldAlert } from 'lucide-react';
import type {
  AlertRuleConfig,
  GridCellForecast,
  OfficialPublicAlert,
  PrecipitationAlertWindow,
  SingaporeRegion,
} from '../types/weather';
import {
  DEFAULT_ALERT_RULES,
  REGION_LABELS_ZH,
  getSeverityMeta,
} from '../utils/weatherGrid';

interface PrecipitationAlertsPanelProps {
  cells: GridCellForecast[];
  alertRules: AlertRuleConfig;
  watchlistIds: string[];
  alertWindows: PrecipitationAlertWindow[];
  acknowledgedIds: string[];
  publicAlerts: OfficialPublicAlert[];
  onChangeRules: (next: AlertRuleConfig) => void;
  onToggleWatch: (cellId: string) => void;
  onToggleAcknowledge: (alertId: string) => void;
  onLocateAlertOnMap: (cellId: string, peakHourIndex: number) => void;
}

const REGIONS_ORDER: SingaporeRegion[] = ['Central', 'East', 'West', 'North', 'North-East'];

export function PrecipitationAlertsPanel({
  cells,
  alertRules,
  watchlistIds,
  alertWindows,
  acknowledgedIds,
  publicAlerts,
  onChangeRules,
  onToggleWatch,
  onToggleAcknowledge,
  onLocateAlertOnMap,
}: PrecipitationAlertsPanelProps) {
  const watchlistSet = new Set(watchlistIds);
  const ackSet = new Set(acknowledgedIds);

  const severeCount = alertWindows.filter((w) => w.severity === 'severe').length;
  const warningCount = alertWindows.filter((w) => w.severity === 'warning').length;
  const watchCount = alertWindows.filter((w) => w.severity === 'watch').length;

  const updateThreshold = (
    key: 'watchThreshold' | 'warningThreshold' | 'severeThreshold' | 'heavyRainMmThreshold' | 'thunderThreshold',
    val: number,
  ) => {
    const next = { ...alertRules, [key]: val };
    // Keep probability thresholds monotonically ordered
    if (key === 'watchThreshold') {
      if (next.warningThreshold < val + 5) next.warningThreshold = Math.min(95, val + 5);
      if (next.severeThreshold < next.warningThreshold + 5) {
        next.severeThreshold = Math.min(98, next.warningThreshold + 5);
      }
    } else if (key === 'warningThreshold') {
      if (next.watchThreshold > val - 5) next.watchThreshold = Math.max(20, val - 5);
      if (next.severeThreshold < val + 5) next.severeThreshold = Math.min(98, val + 5);
    } else if (key === 'severeThreshold') {
      if (next.warningThreshold > val - 5) next.warningThreshold = Math.max(30, val - 5);
      if (next.watchThreshold > next.warningThreshold - 5) {
        next.watchThreshold = Math.max(20, next.warningThreshold - 5);
      }
    }
    onChangeRules(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Configurable Alert Rules & District Watchlist */}
      <section
        aria-label="降水概率预警阈值与关注区域配置"
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">降水概率预警规则</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              实时重算新加坡 26 格网未来 48 小时预警窗口
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeRules(DEFAULT_ALERT_RULES)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-md cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>默认</span>
          </button>
        </div>

        {/* Threshold Sliders */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="rule-watch-threshold" className="font-medium text-blue-700">
                ◆ 蓝色降水关注阈值
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                ≥ {alertRules.watchThreshold}%
              </span>
            </div>
            <input
              id="rule-watch-threshold"
              type="range"
              min={20}
              max={80}
              step={5}
              value={alertRules.watchThreshold}
              onChange={(e) => updateThreshold('watchThreshold', Number(e.target.value))}
              className="meteo-slider w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="rule-warning-threshold" className="font-medium text-orange-700">
                ▲ 橙色降水预警阈值
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                ≥ {alertRules.warningThreshold}%
              </span>
            </div>
            <input
              id="rule-warning-threshold"
              type="range"
              min={30}
              max={90}
              step={5}
              value={alertRules.warningThreshold}
              onChange={(e) => updateThreshold('warningThreshold', Number(e.target.value))}
              className="meteo-slider w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="rule-severe-threshold" className="font-medium text-red-700">
                ✖ 红色暴雨高风险阈值
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                ≥ {alertRules.severeThreshold}%
              </span>
            </div>
            <input
              id="rule-severe-threshold"
              type="range"
              min={45}
              max={95}
              step={5}
              value={alertRules.severeThreshold}
              onChange={(e) => updateThreshold('severeThreshold', Number(e.target.value))}
              className="meteo-slider w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label
                htmlFor="rule-rain-mm"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                强降雨触发 (mm/h)
              </label>
              <input
                id="rule-rain-mm"
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={alertRules.heavyRainMmThreshold}
                onChange={(e) =>
                  updateThreshold('heavyRainMmThreshold', Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label
                htmlFor="rule-thunder-prob"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                雷暴触发 (%)
              </label>
              <input
                id="rule-thunder-prob"
                type="number"
                min={10}
                max={95}
                step={5}
                value={alertRules.thunderThreshold}
                onChange={(e) =>
                  updateThreshold('thunderThreshold', Math.max(10, Math.min(95, Number(e.target.value) || 40)))
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 cursor-pointer">
            <span className="text-xs font-medium text-slate-700">
              仅监控已关注的重点区域 ({watchlistIds.length} 个)
            </span>
            <input
              type="checkbox"
              checked={alertRules.watchlistOnly}
              onChange={(e) =>
                onChangeRules({ ...alertRules, watchlistOnly: e.target.checked })
              }
              className="w-4 h-4 accent-blue-700 rounded cursor-pointer"
            />
          </label>
        </div>

        {/* Watchlist District Picker */}
        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs font-semibold text-slate-800 mb-2">
            重点关注格网订阅 ({watchlistIds.length} / {cells.length})
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {REGIONS_ORDER.map((region) => {
              const regionCells = cells.filter((c) => c.region === region);
              return (
                <div key={region}>
                  <div className="text-[11px] font-medium text-slate-500 mb-1">
                    {REGION_LABELS_ZH[region]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {regionCells.map((cell) => {
                      const active = watchlistSet.has(cell.id);
                      return (
                        <button
                          key={cell.id}
                          type="button"
                          onClick={() => onToggleWatch(cell.id)}
                          aria-pressed={active}
                          className={`px-2 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            active
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cell.nameZh}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right Column: Active 48h Alert Windows + Official Public Alerts */}
      <section aria-label="未来 48 小时降水预警事件列表" className="lg:col-span-8 flex flex-col gap-5">
        {/* Official Google Maps Platform Weather API Public Alerts (with mandatory dataSource attribution) */}
        {publicAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-red-800">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>官方实时气象灾害警报 ({publicAlerts.length})</span>
            </div>
            {publicAlerts.map((alert) => (
              <article
                key={alert.alertId}
                className="bg-white border border-red-200 rounded-lg p-3.5 text-xs space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
                  <span className="font-mono text-red-700 font-semibold">
                    {alert.severity ?? alert.eventType}
                  </span>
                </div>
                <p className="text-slate-600">影响区域：{alert.areaName}</p>
                {alert.description && (
                  <p className="text-slate-700 leading-relaxed">{alert.description}</p>
                )}
                <p className="text-[11px] text-slate-500 pt-1">
                  官方来源：
                  <a
                    href={alert.dataSource.authorityUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline hover:text-blue-900 inline-flex items-center gap-0.5 ml-1"
                  >
                    <span>{alert.dataSource.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </article>
            ))}
          </div>
        )}

        {/* Computed 48h Precipitation Alert Windows Summary */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-900">
                48 小时格网降水概率预警清单
              </h1>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
                <span className="text-red-700 font-semibold">✖ 红色高风险 {severeCount}</span>
                <span aria-hidden="true">·</span>
                <span className="text-orange-700 font-semibold">▲ 橙色预警 {warningCount}</span>
                <span aria-hidden="true">·</span>
                <span className="text-blue-700 font-semibold">◆ 蓝色关注 {watchCount}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              共触发 <span className="font-mono tabular-nums font-semibold text-slate-900">{alertWindows.length}</span> 个连续降水预警窗口
            </div>
          </div>

          {alertWindows.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-emerald-700">● 当前规则下未来 48 小时暂无触发预警</p>
              <p className="text-xs text-slate-500">
                您可以调低左侧降水概率阈值，或取消“仅监控已关注区域”以查看全岛气象动态。
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {alertWindows.map((win) => {
                const meta = getSeverityMeta(win.severity);
                const isAck = ackSet.has(win.id);
                return (
                  <article
                    key={win.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isAck ? 'bg-slate-50/70 opacity-75' : 'bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-semibold ${meta.textClass}`}>
                          {meta.symbol} {meta.label}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {win.cellNameZh}
                        </span>
                        <span className="text-slate-500">
                          {win.regionZh} ({win.cellNameEn})
                        </span>
                      </div>

                      <div className="text-xs text-slate-600">{win.triggerReason}</div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-500">
                        <span>
                          时段：{win.startSgtLabel} – {win.endSgtLabel} ({win.durationHours}h)
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>峰值时刻：{win.peakSgtLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>最大雨量：{win.peakRainMm.toFixed(1)} mm/h</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onLocateAlertOnMap(win.cellId, win.peakHourIndex)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>地图定位</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleAcknowledge(win.id)}
                        aria-pressed={isAck}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                          isAck
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAck ? '已知晓' : '确认预警'}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
