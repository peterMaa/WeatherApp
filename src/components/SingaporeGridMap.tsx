import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
} from '@vis.gl/react-google-maps';
import { Crosshair, Layers, Map as MapIcon, RotateCcw } from 'lucide-react';
import type { AlertRuleConfig, GridCellForecast, WeatherLayer } from '../types/weather';
import {
  SINGAPORE_CENTER,
  evaluateAlertSeverity,
  getLayerColorSpec,
} from '../utils/weatherGrid';

interface SingaporeGridMapProps {
  mapsApiKey: string;
  cells: GridCellForecast[];
  hourIndex: number;
  selectedCellId: string;
  watchlistIds: string[];
  activeLayer: WeatherLayer;
  alertRules: AlertRuleConfig;
  onSelectLayer: (layer: WeatherLayer) => void;
  onSelectCell: (cellId: string) => void;
  quotaExceeded: boolean;
}

const LAYER_OPTIONS: Array<{ id: WeatherLayer; label: string; unit: string }> = [
  { id: 'precipProb', label: '降水概率', unit: '%' },
  { id: 'rainMm', label: '降雨强度', unit: 'mm/h' },
  { id: 'tempC', label: '实时气温', unit: '°C' },
  { id: 'windKmh', label: '阵风风速', unit: 'km/h' },
];

const LAYER_LEGENDS: Record<WeatherLayer, Array<{ label: string; hex: string }>> = {
  precipProb: [
    { label: '<30%', hex: '#cbd5e1' },
    { label: '30–49%', hex: '#38bdf8' },
    { label: '50–69%', hex: '#2563eb' },
    { label: '70–84%', hex: '#ea580c' },
    { label: '≥85%', hex: '#dc2626' },
  ],
  rainMm: [
    { label: '0–0.9', hex: '#cbd5e1' },
    { label: '1–3.9', hex: '#0ea5e9' },
    { label: '4–7.9', hex: '#1d4ed8' },
    { label: '≥8.0 mm/h', hex: '#be123c' },
  ],
  tempC: [
    { label: '<27°C', hex: '#06b6d4' },
    { label: '27–29.9°C', hex: '#10b981' },
    { label: '30–31.9°C', hex: '#f59e0b' },
    { label: '≥32°C', hex: '#dc2626' },
  ],
  windKmh: [
    { label: '<16', hex: '#94a3b8' },
    { label: '16–24', hex: '#0d9488' },
    { label: '≥25 km/h', hex: '#7c3aed' },
  ],
};

// Imperative Google Maps Rectangle Grid Overlay
function GoogleGridRectangles({
  cells,
  hourIndex,
  selectedCellId,
  activeLayer,
  alertRules,
  onSelectCell,
  onHoverCell,
}: {
  cells: GridCellForecast[];
  hourIndex: number;
  selectedCellId: string;
  activeLayer: WeatherLayer;
  alertRules: AlertRuleConfig;
  onSelectCell: (id: string) => void;
  onHoverCell: (id: string | null) => void;
}) {
  const map = useMap();
  const rectStoreRef = useRef<Record<string, google.maps.Rectangle>>({});
  const onSelectRef = useRef(onSelectCell);
  const onHoverRef = useRef(onHoverCell);
  onSelectRef.current = onSelectCell;
  onHoverRef.current = onHoverCell;

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Rectangle) return;

    const currentStore = rectStoreRef.current;
    const activeIds = new Set(cells.map((c) => c.id));

    // Clean up removed rectangles if any
    for (const id of Object.keys(currentStore)) {
      if (!activeIds.has(id)) {
        currentStore[id].setMap(null);
        delete currentStore[id];
      }
    }

    for (const cell of cells) {
      const pt = cell.hourly[hourIndex] ?? cell.hourly[0];
      const spec = getLayerColorSpec(pt, activeLayer);
      const sev = evaluateAlertSeverity(pt, alertRules);
      const isSelected = cell.id === selectedCellId;

      const options: google.maps.RectangleOptions = {
        bounds: cell.bounds,
        map,
        fillColor: spec.fillHex,
        fillOpacity: isSelected ? Math.min(0.78, spec.fillOpacity + 0.16) : spec.fillOpacity,
        strokeColor: isSelected ? '#0f172a' : sev === 'severe' ? '#991b1b' : spec.strokeHex,
        strokeOpacity: isSelected ? 1 : 0.72,
        strokeWeight: isSelected ? 2.5 : sev === 'severe' ? 1.75 : 1,
        zIndex: isSelected ? 40 : sev === 'severe' ? 20 : 10,
        clickable: true,
      };

      if (!currentStore[cell.id]) {
        const rect = new google.maps.Rectangle(options);
        rect.addListener('click', () => onSelectRef.current(cell.id));
        rect.addListener('mouseover', () => onHoverRef.current(cell.id));
        rect.addListener('mouseout', () => onHoverRef.current(null));
        currentStore[cell.id] = rect;
      } else {
        currentStore[cell.id].setOptions(options);
      }
    }
  }, [map, cells, hourIndex, selectedCellId, activeLayer, alertRules]);

  useEffect(() => {
    return () => {
      for (const rect of Object.values(rectStoreRef.current)) {
        rect.setMap(null);
      }
      rectStoreRef.current = {};
    };
  }, []);

  return null;
}

function MapResetButton() {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => {
        if (!map) return;
        map.panTo(SINGAPORE_CENTER);
        map.setZoom(11);
      }}
      aria-label="重置新加坡全岛视角"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 shadow-xs transition-colors cursor-pointer"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      <span>全岛视角</span>
    </button>
  );
}

// Accurate equirectangular projection for Singapore SVG fallback/vector mode
const SG_MIN_LNG = 103.59;
const SG_MAX_LNG = 104.04;
const SG_MIN_LAT = 1.21;
const SG_MAX_LAT = 1.48;

function projectToSvg(lat: number, lng: number, width: number, height: number) {
  const x = ((lng - SG_MIN_LNG) / (SG_MAX_LNG - SG_MIN_LNG)) * width;
  const y = ((SG_MAX_LAT - lat) / (SG_MAX_LAT - SG_MIN_LAT)) * height;
  return { x, y };
}

// Simplified Singapore main island + Sentosa + Pulau Ubin outline coordinates
const SG_MAIN_OUTLINE: Array<[number, number]> = [
  [1.335, 103.615],
  [1.385, 103.655],
  [1.445, 103.705],
  [1.468, 103.790],
  [1.462, 103.855],
  [1.425, 103.905],
  [1.402, 103.968],
  [1.385, 104.008],
  [1.332, 104.005],
  [1.312, 103.962],
  [1.298, 103.905],
  [1.272, 103.860],
  [1.264, 103.812],
  [1.288, 103.745],
  [1.298, 103.670],
  [1.278, 103.628],
  [1.335, 103.615],
];

const SG_SENTOSA_OUTLINE: Array<[number, number]> = [
  [1.256, 103.812],
  [1.258, 103.842],
  [1.242, 103.848],
  [1.244, 103.818],
  [1.256, 103.812],
];

function VectorSingaporeGrid({
  cells,
  hourIndex,
  selectedCellId,
  watchlistIds,
  activeLayer,
  alertRules,
  onSelectCell,
  onHoverCell,
}: {
  cells: GridCellForecast[];
  hourIndex: number;
  selectedCellId: string;
  watchlistIds: string[];
  activeLayer: WeatherLayer;
  alertRules: AlertRuleConfig;
  onSelectCell: (id: string) => void;
  onHoverCell: (id: string | null) => void;
}) {
  const width = 920;
  const height = 520;
  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const toPolyline = (coords: Array<[number, number]>) =>
    coords
      .map(([lat, lng]) => {
        const p = projectToSvg(lat, lng, width, height);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div
      data-testid="vector-singapore-grid"
      className="relative w-full h-[380px] lg:h-[430px] bg-slate-100 overflow-hidden select-none"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        role="img"
        aria-label="新加坡 48 小时气象预报交互式地理格网"
      >
        {/* Subtle ocean lat/lng graticule */}
        <rect x="0" y="0" width={width} height={height} fill="#e8f1f8" />
        {[1.25, 1.3, 1.35, 1.4, 1.45].map((lat) => {
          const { y } = projectToSvg(lat, SG_MIN_LNG, width, height);
          return (
            <g key={`lat-${lat}`}>
              <line x1={0} y1={y} x2={width} y2={y} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3 4" />
              <text x={10} y={y - 4} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {lat.toFixed(2)}°N
              </text>
            </g>
          );
        })}
        {[103.65, 103.75, 103.85, 103.95].map((lng) => {
          const { x } = projectToSvg(SG_MIN_LAT, lng, width, height);
          return (
            <g key={`lng-${lng}`}>
              <line x1={x} y1={0} x2={x} y2={height} stroke="#cbd5e1" strokeWidth="0.75" strokeDasharray="3 4" />
              <text x={x + 4} y={height - 10} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">
                {lng.toFixed(2)}°E
              </text>
            </g>
          );
        })}

        {/* Singapore coastline base polygon */}
        <polygon
          points={toPolyline(SG_MAIN_OUTLINE)}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <polygon
          points={toPolyline(SG_SENTOSA_OUTLINE)}
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.25"
        />

        {/* Interactive forecast grid cells */}
        {cells.map((cell) => {
          const pt = cell.hourly[hourIndex] ?? cell.hourly[0];
          const spec = getLayerColorSpec(pt, activeLayer);
          const sev = evaluateAlertSeverity(pt, alertRules);
          const isSelected = cell.id === selectedCellId;
          const isWatched = watchlistSet.has(cell.id);

          const nw = projectToSvg(cell.bounds.north, cell.bounds.west, width, height);
          const se = projectToSvg(cell.bounds.south, cell.bounds.east, width, height);
          const cellW = se.x - nw.x;
          const cellH = se.y - nw.y;
          const cx = nw.x + cellW / 2;
          const cy = nw.y + cellH / 2;

          return (
            <g
              key={cell.id}
              onClick={() => onSelectCell(cell.id)}
              onMouseEnter={() => onHoverCell(cell.id)}
              onMouseLeave={() => onHoverCell(null)}
              role="button"
              tabIndex={0}
              aria-label={`选择气象格网 ${cell.nameZh}，${spec.formattedValue}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectCell(cell.id);
                }
              }}
              className="cursor-pointer focus:outline-none"
            >
              <rect
                x={nw.x + 1}
                y={nw.y + 1}
                width={Math.max(4, cellW - 2)}
                height={Math.max(4, cellH - 2)}
                rx={4}
                fill={spec.fillHex}
                fillOpacity={isSelected ? Math.min(0.84, spec.fillOpacity + 0.16) : spec.fillOpacity}
                stroke={isSelected ? '#0f172a' : sev === 'severe' ? '#991b1b' : spec.strokeHex}
                strokeWidth={isSelected ? 2.5 : sev === 'severe' ? 1.6 : 1}
              />
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                fill={spec.fillOpacity >= 0.44 ? '#ffffff' : '#0f172a'}
                fontSize="12"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {spec.formattedValue}
              </text>
              <text
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fill={spec.fillOpacity >= 0.44 ? '#f8fafc' : '#334155'}
                fontSize="10"
                fontWeight="500"
              >
                {cell.nameZh.length > 4 ? cell.nameZh.slice(0, 4) : cell.nameZh}
              </text>
              {isWatched && (
                <circle
                  cx={nw.x + cellW - 9}
                  cy={nw.y + 9}
                  r={3.5}
                  fill="#ffffff"
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatShortName(nameZh: string): string {
  return nameZh.split('/')[0].trim().slice(0, 4);
}

export function SingaporeGridMap({
  mapsApiKey,
  cells,
  hourIndex,
  selectedCellId,
  watchlistIds,
  activeLayer,
  alertRules,
  onSelectLayer,
  onSelectCell,
  quotaExceeded,
}: SingaporeGridMapProps) {
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [preferVectorMode, setPreferVectorMode] = useState(false);

  const canUseGoogleMap = Boolean(mapsApiKey) && !quotaExceeded && !preferVectorMode;

  const hoveredCell = useMemo(
    () => cells.find((c) => c.id === hoveredCellId) ?? null,
    [cells, hoveredCellId],
  );

  // Highlight selected cell + up to 2 spatially separated high-risk hotspots (prevents label collision)
  const markerCells = useMemo(() => {
    const chosen: GridCellForecast[] = [];
    const selected = cells.find((c) => c.id === selectedCellId);
    if (selected) chosen.push(selected);

    const candidates = cells
      .filter((c) => {
        if (c.id === selectedCellId) return false;
        const pt = c.hourly[hourIndex] ?? c.hourly[0];
        const sev = evaluateAlertSeverity(pt, alertRules);
        return sev === 'severe' || sev === 'warning';
      })
      .sort((a, b) => (b.hourly[hourIndex]?.precipProb ?? 0) - (a.hourly[hourIndex]?.precipProb ?? 0));

    for (const candidate of candidates) {
      if (chosen.length >= 3) break;
      const tooClose = chosen.some((placed) => {
        const dLat = Math.abs(placed.center.lat - candidate.center.lat);
        const dLng = Math.abs(placed.center.lng - candidate.center.lng);
        return dLat < 0.065 && dLng < 0.11;
      });
      if (!tooClose) {
        chosen.push(candidate);
      }
    }

    return chosen;
  }, [cells, hourIndex, selectedCellId, alertRules]);

  const activeLayerMeta = LAYER_OPTIONS.find((l) => l.id === activeLayer) ?? LAYER_OPTIONS[0];

  return (
    <section
      aria-label="新加坡 48 小时气象预报交互格网地图"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Map Toolbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-slate-500 shrink-0" />
          <div
            role="group"
            aria-label="气象图层切换"
            className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg overflow-x-auto"
          >
            {LAYER_OPTIONS.map((layer) => {
              const isActive = activeLayer === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onSelectLayer(layer.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-500 whitespace-nowrap">
              图例 ({activeLayerMeta.unit})
            </span>
            <div className="flex items-center gap-1.5">
              {LAYER_LEGENDS[activeLayer].map((stop) => (
                <span key={stop.label} className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span
                    className="w-2.5 h-2.5 rounded-xs inline-block border border-slate-300/60"
                    style={{ backgroundColor: stop.hex }}
                    aria-hidden="true"
                  />
                  <span className="font-mono tabular-nums text-[11px]">{stop.label}</span>
                </span>
              ))}
            </div>
          </div>

          {Boolean(mapsApiKey) && !quotaExceeded && (
            <button
              type="button"
              onClick={() => setPreferVectorMode((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>{preferVectorMode ? '切换 Google 底图' : '切换纯格网视图'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="relative">
        {canUseGoogleMap ? (
          <div data-testid="google-singapore-map" className="w-full h-[380px] lg:h-[430px]">
            <APIProvider apiKey={mapsApiKey} language="zh-CN" region="SG">
              <GoogleMap
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                defaultCenter={SINGAPORE_CENTER}
                defaultZoom={11}
                minZoom={10}
                maxZoom={15}
                gestureHandling="greedy"
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={false}
                className="w-full h-full"
              >
                <GoogleGridRectangles
                  cells={cells}
                  hourIndex={hourIndex}
                  selectedCellId={selectedCellId}
                  activeLayer={activeLayer}
                  alertRules={alertRules}
                  onSelectCell={onSelectCell}
                  onHoverCell={setHoveredCellId}
                />

                {markerCells.map((cell) => {
                  const pt = cell.hourly[hourIndex] ?? cell.hourly[0];
                  const spec = getLayerColorSpec(pt, activeLayer);
                  const isSelected = cell.id === selectedCellId;
                  return (
                    <AdvancedMarker
                      key={cell.id}
                      position={cell.center}
                      zIndex={isSelected ? 100 : 60}
                      onClick={() => onSelectCell(cell.id)}
                    >
                      <div
                        className={`px-2 py-0.5 rounded text-[11px] font-mono tabular-nums font-semibold shadow-sm border whitespace-nowrap ${
                          isSelected
                            ? 'bg-slate-900 text-white border-white'
                            : 'bg-white/95 text-slate-900 border-slate-300'
                        }`}
                      >
                        {formatShortName(cell.nameZh)} {spec.formattedValue}
                      </div>
                    </AdvancedMarker>
                  );
                })}

                <div className="absolute top-3 right-3 z-10">
                  <MapResetButton />
                </div>
              </GoogleMap>
            </APIProvider>
          </div>
        ) : (
          <VectorSingaporeGrid
            cells={cells}
            hourIndex={hourIndex}
            selectedCellId={selectedCellId}
            watchlistIds={watchlistIds}
            activeLayer={activeLayer}
            alertRules={alertRules}
            onSelectCell={onSelectCell}
            onHoverCell={setHoveredCellId}
          />
        )}

        {/* Crosshair Hover Telemetry Readout */}
        {hoveredCell && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Crosshair className="w-3.5 h-3.5 text-blue-700" />
              <span>
                {hoveredCell.nameZh} · {hoveredCell.code}
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500">
                {hoveredCell.center.lat.toFixed(3)}°N, {hoveredCell.center.lng.toFixed(3)}°E
              </span>
            </div>
            {(() => {
              const pt = hoveredCell.hourly[hourIndex] ?? hoveredCell.hourly[0];
              return (
                <div className="mt-1 flex items-center gap-3 font-mono tabular-nums text-[11px] text-slate-600">
                  <span>降水 {pt.precipProb}%</span>
                  <span>雨量 {pt.rainMm.toFixed(1)} mm/h</span>
                  <span>气温 {pt.tempC.toFixed(1)}°C</span>
                  <span>风速 {pt.windKmh.toFixed(1)} km/h</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </section>
  );
}
