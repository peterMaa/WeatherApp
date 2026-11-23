import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, ChevronRight } from 'lucide-react';
import { HeaderBar, type ActiveTab } from './components/HeaderBar';
import { SingaporeGridMap } from './components/SingaporeGridMap';
import { TimelineScrubber } from './components/TimelineScrubber';
import { CellInspectorPanel } from './components/CellInspectorPanel';
import { ForecastMatrixView } from './components/ForecastMatrixView';
import { PrecipitationAlertsPanel } from './components/PrecipitationAlertsPanel';
import { MapsGroundingAdvisory } from './components/MapsGroundingAdvisory';
import type {
  AlertRuleConfig,
  GridCellForecast,
  OfficialPublicAlert,
  WeatherGridApiResponse,
  WeatherLayer,
} from './types/weather';
import {
  DEFAULT_ALERT_RULES,
  DEFAULT_WATCHLIST_IDS,
  buildFallbackGridForecast,
  extractAlertWindows,
  findPeakRiskHour,
  getSeverityMeta,
  summarizeHourSnapshot,
} from './utils/weatherGrid';

const RULES_STORAGE_KEY = 'sg-meteogrid-alert-rules-v1';
const WATCHLIST_STORAGE_KEY = 'sg-meteogrid-watchlist-v1';

function loadStoredRules(): AlertRuleConfig {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_RULES;
    const parsed = JSON.parse(raw) as Partial<AlertRuleConfig>;
    return {
      watchThreshold: Number(parsed.watchThreshold ?? DEFAULT_ALERT_RULES.watchThreshold),
      warningThreshold: Number(parsed.warningThreshold ?? DEFAULT_ALERT_RULES.warningThreshold),
      severeThreshold: Number(parsed.severeThreshold ?? DEFAULT_ALERT_RULES.severeThreshold),
      heavyRainMmThreshold: Number(parsed.heavyRainMmThreshold ?? DEFAULT_ALERT_RULES.heavyRainMmThreshold),
      thunderThreshold: Number(parsed.thunderThreshold ?? DEFAULT_ALERT_RULES.thunderThreshold),
      watchlistOnly: Boolean(parsed.watchlistOnly ?? DEFAULT_ALERT_RULES.watchlistOnly),
    };
  } catch {
    return DEFAULT_ALERT_RULES;
  }
}

function loadStoredWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST_IDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : DEFAULT_WATCHLIST_IDS;
  } catch {
    return DEFAULT_WATCHLIST_IDS;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '',
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [cells, setCells] = useState<GridCellForecast[]>(() => buildFallbackGridForecast());
  const [publicAlerts, setPublicAlerts] = useState<OfficialPublicAlert[]>([]);
  const [sourceLabel, setSourceLabel] = useState('正在同步新加坡 48h 气象格网...');
  const [generatedAt, setGeneratedAt] = useState<string>(new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [hourIndex, setHourIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLayer, setActiveLayer] = useState<WeatherLayer>('precipProb');
  const [selectedCellId, setSelectedCellId] = useState<string>('sg-marina-bay');

  const [alertRules, setAlertRules] = useState<AlertRuleConfig>(loadStoredRules);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(loadStoredWatchlist);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);

  // Persist user alert rules and watchlist
  useEffect(() => {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(alertRules));
    } catch {
      // ignore storage failures
    }
  }, [alertRules]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistIds));
    } catch {
      // ignore storage failures
    }
  }, [watchlistIds]);

  // Listen for Tier-1 Google Maps Demo Key quota exceeded events
  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Load Maps JS browser key fallback from server config if not inlined via Vite env
  useEffect(() => {
    if (mapsApiKey) return;
    let active = true;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mapsApiKey?: string } | null) => {
        if (active && data?.mapsApiKey) {
          setMapsApiKey(data.mapsApiKey);
        }
      })
      .catch(() => {
        // graceful fallback to vector Singapore grid
      });
    return () => {
      active = false;
    };
  }, [mapsApiKey]);

  const fetchWeatherGrid = useCallback(async (forceRefresh = false) => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/weather/grid${forceRefresh ? '?refresh=1' : ''}`);
      if (res.status === 429) {
        setQuotaExceeded(true);
      }
      if (!res.ok) {
        throw new Error(`天气预报服务返回状态 ${res.status}`);
      }
      const data = (await res.json()) as WeatherGridApiResponse;
      if (data.quotaExceeded) {
        setQuotaExceeded(true);
      }
      if (Array.isArray(data.cells) && data.cells.length > 0) {
        setCells(data.cells);
        setPublicAlerts(Array.isArray(data.publicAlerts) ? data.publicAlerts : []);
        setSourceLabel(data.sourceLabel);
        setGeneratedAt(data.generatedAt);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '同步预报失败，当前显示本地基准模型。');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchWeatherGrid(false);
  }, [fetchWeatherGrid]);

  // 48h timeline playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setHourIndex((prev) => (prev >= 47 ? 0 : prev + 1));
    }, 650);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const selectedCell = useMemo(
    () => cells.find((c) => c.id === selectedCellId) ?? cells[0],
    [cells, selectedCellId],
  );

  const alertWindows = useMemo(
    () => extractAlertWindows(cells, alertRules, watchlistIds),
    [cells, alertRules, watchlistIds],
  );

  const highRiskWindows = useMemo(
    () => alertWindows.filter((w) => w.severity === 'severe' || w.severity === 'warning'),
    [alertWindows],
  );

  const unacknowledgedHighRiskCount = useMemo(() => {
    const ackSet = new Set(acknowledgedIds);
    return highRiskWindows.filter((w) => !ackSet.has(w.id)).length;
  }, [highRiskWindows, acknowledgedIds]);

  const hourSummary = useMemo(
    () => summarizeHourSnapshot(cells, hourIndex, alertRules),
    [cells, hourIndex, alertRules],
  );

  const peakRisk = useMemo(() => findPeakRiskHour(cells), [cells]);

  const handleToggleWatch = useCallback((cellId: string) => {
    setWatchlistIds((prev) =>
      prev.includes(cellId) ? prev.filter((id) => id !== cellId) : [...prev, cellId],
    );
  }, []);

  const handleToggleAcknowledge = useCallback((alertId: string) => {
    setAcknowledgedIds((prev) =>
      prev.includes(alertId) ? prev.filter((id) => id !== alertId) : [...prev, alertId],
    );
  }, []);

  const handleJumpToPeak = useCallback(() => {
    setIsPlaying(false);
    setHourIndex(peakRisk.hourIndex);
    setSelectedCellId(peakRisk.cellId);
  }, [peakRisk]);

  const handleLocateAlertOnMap = useCallback((cellId: string, peakHour: number) => {
    setIsPlaying(false);
    setSelectedCellId(cellId);
    setHourIndex(peakHour);
    setActiveLayer('precipProb');
    setActiveTab('map');
  }, []);

  const topAlert = highRiskWindows[0] ?? alertWindows[0] ?? null;
  const topAlertMeta = topAlert ? getSeverityMeta(topAlert.severity) : null;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Required Google Maps Platform Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar */}
      <HeaderBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRefresh={() => void fetchWeatherGrid(true)}
        isRefreshing={isRefreshing}
        activeAlertCount={unacknowledgedHighRiskCount}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Active Precipitation Probability Alert Strip (Non-hue-only, actionable) */}
        {topAlert && topAlertMeta && (
          <div
            role="status"
            aria-live="polite"
            className={`px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${topAlertMeta.surfaceClass} ${topAlertMeta.borderClass}`}
          >
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 text-xs sm:text-sm">
              <BellRing className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${topAlertMeta.textClass}`} />
              <div className="min-w-0">
                <span className={`font-bold ${topAlertMeta.textClass}`}>
                  {topAlertMeta.symbol} {topAlertMeta.label}
                </span>
                <span className="text-slate-400 mx-2" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-800 font-medium">
                  未来 48h 共监测到{' '}
                  <strong className="font-mono tabular-nums">{highRiskWindows.length}</strong>{' '}
                  个高风险降水时段，首要关注{' '}
                  <strong>{topAlert.cellNameZh}</strong>（峰值{' '}
                  <strong className="font-mono tabular-nums">{topAlert.peakPrecipProb}%</strong>，
                  {topAlert.peakSgtLabel}）
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleLocateAlertOnMap(topAlert.cellId, topAlert.peakHourIndex)}
                className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                定位峰值格网
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('alerts')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>预警规则与清单</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {loadError && (
          <div className="px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* TAB 1: Interactive Singapore Map Grid + Inspector */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            {/* 4-Column Full-Width Island Telemetry Summary Strip */}
            <section
              aria-label="当前预报时刻新加坡全岛指标概览"
              className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 truncate">当前时刻最高降水概率</div>
                <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div className="flex items-baseline whitespace-nowrap">
                    <span
                      className={`text-2xl font-mono tabular-nums font-bold ${
                        hourSummary.maxPrecipProb >= alertRules.severeThreshold
                          ? 'text-red-700'
                          : hourSummary.maxPrecipProb >= alertRules.warningThreshold
                            ? 'text-orange-700'
                            : 'text-slate-900'
                      }`}
                    >
                      {hourSummary.maxPrecipProb}
                    </span>
                    <span className="text-xs font-mono text-slate-500 ml-1">%</span>
                  </div>
                  <span className="text-xs text-slate-600 truncate">
                    热点：{hourSummary.hotspotNameZh}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 truncate">当前触发预警格网</div>
                <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div className="flex items-baseline whitespace-nowrap">
                    <span className="text-2xl font-mono tabular-nums font-bold text-slate-900">
                      {hourSummary.severeCount + hourSummary.warningCount}
                    </span>
                    <span className="text-xs font-mono text-slate-500 ml-1">/ {cells.length}</span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    红 {hourSummary.severeCount} · 橙 {hourSummary.warningCount} · 蓝{' '}
                    {hourSummary.watchCount}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 truncate">全岛最大小时降雨强度</div>
                <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div className="flex items-baseline whitespace-nowrap">
                    <span className="text-2xl font-mono tabular-nums font-bold text-slate-900">
                      {hourSummary.maxRainMm.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono text-slate-500 ml-1">mm/h</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    均概率 {hourSummary.avgPrecipProb}%
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs text-slate-500 truncate">全岛平均气温与时刻</div>
                <div className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div className="flex items-baseline whitespace-nowrap">
                    <span className="text-2xl font-mono tabular-nums font-bold text-slate-900">
                      {hourSummary.avgTempC.toFixed(1)}
                    </span>
                    <span className="text-xs font-mono text-slate-500 ml-1">°C</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {hourSummary.sgtLabel}
                  </span>
                </div>
              </div>
            </section>

            {/* Asymmetric Split Workspace: Main Map + Right Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-8 space-y-3.5">
                <SingaporeGridMap
                  mapsApiKey={mapsApiKey}
                  cells={cells}
                  hourIndex={hourIndex}
                  selectedCellId={selectedCell.id}
                  watchlistIds={watchlistIds}
                  activeLayer={activeLayer}
                  alertRules={alertRules}
                  onSelectLayer={setActiveLayer}
                  onSelectCell={setSelectedCellId}
                  quotaExceeded={quotaExceeded}
                />

                <TimelineScrubber
                  cells={cells}
                  hourIndex={hourIndex}
                  isPlaying={isPlaying}
                  alertRules={alertRules}
                  peakHourIndex={peakRisk.hourIndex}
                  peakPrecipProb={peakRisk.peakPrecipProb}
                  onChangeHour={(h) => {
                    setIsPlaying(false);
                    setHourIndex(h);
                  }}
                  onTogglePlay={() => setIsPlaying((p) => !p)}
                  onJumpToPeak={handleJumpToPeak}
                />
              </div>

              <div className="lg:col-span-4">
                <CellInspectorPanel
                  cell={selectedCell}
                  hourIndex={hourIndex}
                  alertRules={alertRules}
                  isWatched={watchlistIds.includes(selectedCell.id)}
                  onToggleWatch={handleToggleWatch}
                  onChangeHour={(h) => {
                    setIsPlaying(false);
                    setHourIndex(h);
                  }}
                  onOpenGroundingForCell={() => setActiveTab('grounding')}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 48-Hour Spatiotemporal Matrix */}
        {activeTab === 'matrix' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8">
              <ForecastMatrixView
                cells={cells}
                hourIndex={hourIndex}
                selectedCellId={selectedCell.id}
                watchlistIds={watchlistIds}
                activeLayer={activeLayer}
                alertRules={alertRules}
                onSelectLayer={setActiveLayer}
                onSelectCellAndHour={(cellId, h, switchToMap) => {
                  setIsPlaying(false);
                  setSelectedCellId(cellId);
                  setHourIndex(h);
                  if (switchToMap) setActiveTab('map');
                }}
              />
            </div>
            <div className="lg:col-span-4">
              <CellInspectorPanel
                cell={selectedCell}
                hourIndex={hourIndex}
                alertRules={alertRules}
                isWatched={watchlistIds.includes(selectedCell.id)}
                onToggleWatch={handleToggleWatch}
                onChangeHour={(h) => {
                  setIsPlaying(false);
                  setHourIndex(h);
                }}
                onOpenGroundingForCell={() => setActiveTab('grounding')}
              />
            </div>
          </div>
        )}

        {/* TAB 3: Precipitation Probability Alert Center */}
        {activeTab === 'alerts' && (
          <PrecipitationAlertsPanel
            cells={cells}
            alertRules={alertRules}
            watchlistIds={watchlistIds}
            alertWindows={alertWindows}
            acknowledgedIds={acknowledgedIds}
            publicAlerts={publicAlerts}
            onChangeRules={setAlertRules}
            onToggleWatch={handleToggleWatch}
            onToggleAcknowledge={handleToggleAcknowledge}
            onLocateAlertOnMap={handleLocateAlertOnMap}
          />
        )}

        {/* TAB 4: Google Maps Grounding Local Rain Advisory */}
        {activeTab === 'grounding' && (
          <MapsGroundingAdvisory
            cells={cells}
            selectedCell={selectedCell}
            hourIndex={hourIndex}
            alertRules={alertRules}
            onSelectCell={setSelectedCellId}
          />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            <span>数据源：{sourceLabel}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums">
              更新于 {new Date(generatedAt).toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
          </div>
          <div>
            <span>覆盖范围：新加坡全岛 26 气象格网（48h 逐小时）</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
