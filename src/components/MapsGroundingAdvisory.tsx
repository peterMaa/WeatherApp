import { FormEvent, useState } from 'react';
import Markdown from 'react-markdown';
import { Compass, ExternalLink, Loader2, LocateFixed, MapPin, Send } from 'lucide-react';
import type {
  AlertRuleConfig,
  GridCellForecast,
  MapsGroundingResponse,
} from '../types/weather';
import { evaluateAlertSeverity, getSeverityMeta } from '../utils/weatherGrid';

interface MapsGroundingAdvisoryProps {
  cells: GridCellForecast[];
  selectedCell: GridCellForecast;
  hourIndex: number;
  alertRules: AlertRuleConfig;
  onSelectCell: (cellId: string) => void;
}

const PRESET_QUERIES = [
  '查找附近带遮雨连廊的 MRT 地铁站与大型室内避雨枢纽',
  '分析周边强降雨期间易积水路段，并推荐室内换乘与通勤路线',
  '推荐该区域适合暴雨预警期间停留的室内商场、图书馆或餐饮场所',
];

export function MapsGroundingAdvisory({
  cells,
  selectedCell,
  hourIndex,
  alertRules,
  onSelectCell,
}: MapsGroundingAdvisoryProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MapsGroundingResponse | null>(null);
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  const currentPt = selectedCell.hourly[hourIndex] ?? selectedCell.hourly[0];
  const severity = evaluateAlertSeverity(currentPt, alertRules);
  const sevMeta = getSeverityMeta(severity);

  // Build concise 48h forecast summary for selected cell
  let peakProb = 0;
  let peakLabel = currentPt.sgtLabel;
  let peakRain = 0;
  for (const pt of selectedCell.hourly) {
    if (pt.precipProb > peakProb) {
      peakProb = pt.precipProb;
      peakLabel = pt.sgtLabel;
    }
    if (pt.rainMm > peakRain) peakRain = pt.rainMm;
  }

  const activeCoords = customCoords ?? selectedCell.center;

  const requestAdvisory = async (queryText: string) => {
    setLoading(true);
    setError(null);
    try {
      const weatherSummary = `当前时刻(${currentPt.sgtLabel})降水概率 ${currentPt.precipProb}%、雨量 ${currentPt.rainMm}mm/h、气温 ${currentPt.tempC}°C；未来48小时最高降水概率 ${peakProb}%（预计出现在 ${peakLabel}），峰值小时雨量 ${peakRain.toFixed(1)}mm/h。`;

      const res = await fetch('/api/maps-grounding/advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: activeCoords.lat,
          lng: activeCoords.lng,
          cellNameZh: selectedCell.nameZh,
          cellNameEn: selectedCell.nameEn,
          prompt: queryText,
          weatherSummary,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | (MapsGroundingResponse & { error?: string })
        | null;

      if (!res.ok) {
        throw new Error(payload?.error || `请求失败 (${res.status})`);
      }
      if (!payload || typeof payload.text !== 'string') {
        throw new Error('服务返回格式异常，请重试。');
      }

      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法获取 Google Maps 地点参谋，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    void requestAdvisory(prompt.trim());
  };

  const handleUseGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('当前浏览器不支持定位服务，将继续使用所选格网中心坐标。');
      return;
    }
    setGeoStatus('正在获取当前定位...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (latitude >= 1.15 && latitude <= 1.55 && longitude >= 103.55 && longitude <= 104.15) {
          setCustomCoords({ lat: latitude, lng: longitude });
          setGeoStatus(`已同步当前位置 (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`);
        } else {
          setCustomCoords(null);
          setGeoStatus('检测到您不在新加坡境内，已保持使用当前选中的新加坡格网坐标。');
        }
      },
      () => {
        setGeoStatus('未能获取定位权限，已保持使用当前选中的新加坡格网坐标。');
      },
      { timeout: 5000 },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Panel: Location Context + Query Form */}
      <section
        aria-label="Google Maps 地点防雨参谋查询"
        className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="pb-3 border-b border-slate-200">
          <h1 className="text-base font-bold text-slate-900">
            Google Maps 实景防雨与避险参谋
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            结合当前格网 48h 降水预警与 Google Maps 真实地点数据，定位周边有盖地铁站、室内避雨枢纽及通勤建议。
          </p>
        </div>

        {/* Target District Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="grounding-cell-select" className="text-xs font-semibold text-slate-700">
              目标气象格网
            </label>
            <button
              type="button"
              onClick={handleUseGeolocation}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>使用我的定位</span>
            </button>
          </div>
          <select
            id="grounding-cell-select"
            value={selectedCell.id}
            onChange={(e) => {
              setCustomCoords(null);
              setGeoStatus(null);
              onSelectCell(e.target.value);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          >
            {cells.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameZh} ({c.nameEn}) · {c.regionZh}
              </option>
            ))}
          </select>

          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono tabular-nums text-slate-500">
                {activeCoords.lat.toFixed(4)}°N, {activeCoords.lng.toFixed(4)}°E
              </span>
              <span className={`font-semibold ${sevMeta.textClass}`}>
                {sevMeta.symbol} {sevMeta.label}
              </span>
            </div>
            <div className="text-slate-700 font-mono tabular-nums">
              当前 {currentPt.precipProb}% · 48h 峰值 {peakProb}% ({peakLabel})
            </div>
            {geoStatus && <div className="text-[11px] text-blue-700 pt-0.5">{geoStatus}</div>}
          </div>
        </div>

        {/* Preset Quick Actions */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">快捷场景查询</div>
          <div className="flex flex-col gap-2">
            {PRESET_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => {
                  setPrompt(q);
                  void requestAdvisory(q);
                }}
                className="text-left px-3 py-2 text-xs text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-800 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Question Form */}
        <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-slate-200">
          <label htmlFor="grounding-custom-prompt" className="block text-xs font-semibold text-slate-700">
            自定义防雨或周边地点问题
          </label>
          <div className="flex gap-2">
            <input
              id="grounding-custom-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例：从这里步行到最近有盖地铁口要多久？"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>查询</span>
            </button>
          </div>
        </form>
      </section>

      {/* Right Panel: Grounded Markdown Output + Mandatory Google Maps Source Links */}
      <section
        aria-label="Google Maps 地点参谋结果"
        className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 min-h-[380px] flex flex-col"
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-700 animate-spin" />
            <div className="text-sm font-medium text-slate-800">
              正在检索 {selectedCell.nameZh} 周边 Google Maps 实景地点...
            </div>
            <p className="text-xs text-slate-500">
              结合未来 48 小时降水概率与真实地铁/连廊位置生成避雨指引
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-3">
            <div className="text-sm font-semibold text-red-700">地点参谋请求失败</div>
            <p className="text-xs text-slate-600 max-w-md">{error}</p>
            <button
              type="button"
              onClick={() => void requestAdvisory(prompt.trim() || PRESET_QUERIES[0])}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              重试查询
            </button>
          </div>
        ) : result ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Compass className="w-4 h-4 text-blue-700" />
                <span>{result.locationLabel} · 防雨实地指引</span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                Google Maps Grounding
              </span>
            </div>

            <div className="grounding-prose text-sm text-slate-700">
              <Markdown>{result.text}</Markdown>
            </div>

            {/* Mandatory Grounding Chunks Google Maps Links */}
            <div className="pt-4 border-t border-slate-200 space-y-2.5">
              <h2 className="text-xs font-semibold text-slate-800">
                Google Maps 实景地点来源 ({result.places.length})
              </h2>
              {result.places.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {result.places.map((place) => (
                    <li
                      key={place.uri}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-1.5"
                    >
                      <a
                        href={place.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start justify-between gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{place.title}</span>
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      </a>
                      {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          “{place.reviewSnippets[0]}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  本次回答未返回独立地点卡片链接，可尝试更具体的地铁站或地标问题。
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center gap-3">
            <Compass className="w-7 h-7 text-slate-400" />
            <div className="text-sm font-semibold text-slate-800">
              选择左侧快捷场景或输入您的问题
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              基于 <span className="font-semibold text-slate-700">{selectedCell.nameZh}</span> 的 48 小时降水概率与实时坐标，通过 Google Maps 数据为您检索最近的室内避雨场所、有盖地铁通道及雨天出行方案。
            </p>
            <button
              type="button"
              onClick={() => void requestAdvisory(PRESET_QUERIES[0])}
              className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>立即查询 {selectedCell.nameZh} 周边避雨点</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
