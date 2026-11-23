import type {
  AlertRuleConfig,
  AlertSeverity,
  GridCellDefinition,
  GridCellForecast,
  HourlyForecastPoint,
  PrecipitationAlertWindow,
  SingaporeRegion,
  WeatherLayer,
} from '../types/weather';

export const SINGAPORE_CENTER = { lat: 1.3521, lng: 103.8198 } as const;

export const DEFAULT_ALERT_RULES: AlertRuleConfig = {
  watchThreshold: 50,
  warningThreshold: 70,
  severeThreshold: 85,
  heavyRainMmThreshold: 5.0,
  thunderThreshold: 65,
  watchlistOnly: false,
};

export const DEFAULT_WATCHLIST_IDS = [
  'sg-marina-bay',
  'sg-orchard',
  'sg-changi',
  'sg-jurong-east',
  'sg-woodlands',
];

export const REGION_LABELS_ZH: Record<SingaporeRegion, string> = {
  Central: '中部',
  North: '北部',
  'North-East': '东北部',
  East: '东部',
  West: '西部',
};

// Grid cell half-extents (approx. 4.8km × 5.4km per Singapore forecast tile)
const LAT_STEP = 0.044;
const LNG_STEP = 0.048;

function createCell(
  id: string,
  code: string,
  nameZh: string,
  nameEn: string,
  region: SingaporeRegion,
  row: number,
  col: number,
  lat: number,
  lng: number,
): GridCellDefinition {
  const halfLat = LAT_STEP / 2;
  const halfLng = LNG_STEP / 2;
  return {
    id,
    code,
    nameZh,
    nameEn,
    region,
    regionZh: REGION_LABELS_ZH[region],
    row,
    col,
    center: { lat, lng },
    bounds: {
      north: Number((lat + halfLat).toFixed(5)),
      south: Number((lat - halfLat).toFixed(5)),
      east: Number((lng + halfLng).toFixed(5)),
      west: Number((lng - halfLng).toFixed(5)),
    },
  };
}

/**
 * 24-cell structured forecast grid covering Singapore's main island & coastal hubs.
 * Grid rows 0..4 (North -> South), cols 0..6 (West -> East).
 */
export const SINGAPORE_GRID_CELLS: GridCellDefinition[] = [
  // Row 0 — Northern Strait (Woodlands / Sembawang / Punggol Coast)
  createCell('sg-kranji', 'N1', '克兰芝湿地', 'Kranji', 'North', 0, 2, 1.434, 103.736),
  createCell('sg-woodlands', 'N2', '兀兰关卡', 'Woodlands', 'North', 0, 3, 1.434, 103.784),
  createCell('sg-sembawang', 'N3', '三巴旺', 'Sembawang', 'North', 0, 4, 1.434, 103.832),
  createCell('sg-yishun-north', 'N4', '义顺北', 'Yishun North', 'North', 0, 5, 1.434, 103.880),

  // Row 1 — Upper Corridor (Lim Chu Kang -> Changi Point)
  createCell('sg-lim-chu-kang', 'W1', '林厝港', 'Lim Chu Kang', 'West', 1, 1, 1.390, 103.688),
  createCell('sg-choa-chu-kang', 'W2', '蔡厝港', 'Choa Chu Kang', 'West', 1, 2, 1.390, 103.736),
  createCell('sg-mandai', 'N5', '万礼保护区', 'Mandai', 'North', 1, 3, 1.390, 103.784),
  createCell('sg-ang-mo-kio', 'NE1', '宏茂桥', 'Ang Mo Kio', 'North-East', 1, 4, 1.390, 103.832),
  createCell('sg-sengkang', 'NE2', '盛港', 'Sengkang', 'North-East', 1, 5, 1.390, 103.880),
  createCell('sg-punggol', 'NE3', '榜鹅数码区', 'Punggol', 'North-East', 1, 6, 1.390, 103.928),
  createCell('sg-pasir-ris', 'E1', '巴西立', 'Pasir Ris', 'East', 1, 7, 1.390, 103.976),

  // Row 2 — Central Spine (Tuas North -> Changi Airport)
  createCell('sg-boon-lay', 'W3', '文礼', 'Boon Lay', 'West', 2, 1, 1.346, 103.688),
  createCell('sg-jurong-east', 'W4', '裕廊东', 'Jurong East', 'West', 2, 2, 1.346, 103.736),
  createCell('sg-bukit-timah', 'C1', '武吉知马', 'Bukit Timah', 'Central', 2, 3, 1.346, 103.784),
  createCell('sg-bishan', 'C2', '碧山 / 大巴窑', 'Bishan & Toa Payoh', 'Central', 2, 4, 1.346, 103.832),
  createCell('sg-serangoon', 'NE4', '实龙岗 / 后港', 'Serangoon', 'North-East', 2, 5, 1.346, 103.880),
  createCell('sg-tampines', 'E2', '淡滨尼', 'Tampines', 'East', 2, 6, 1.346, 103.928),
  createCell('sg-changi', 'E3', '樟宜机场', 'Changi Airport', 'East', 2, 7, 1.346, 103.976),

  // Row 3 — Southern Waterfront & Urban Core (Tuas -> East Coast)
  createCell('sg-tuas', 'W5', '大士工业区', 'Tuas', 'West', 3, 0, 1.302, 103.640),
  createCell('sg-jurong-island', 'W6', '裕廊西港', 'Jurong Port', 'West', 3, 1, 1.302, 103.688),
  createCell('sg-clementi', 'W7', '金文泰 / 国大', 'Clementi & NUS', 'West', 3, 2, 1.302, 103.736),
  createCell('sg-queenstown', 'C3', '女皇镇', 'Queenstown', 'Central', 3, 3, 1.302, 103.784),
  createCell('sg-orchard', 'C4', '乌节路', 'Orchard', 'Central', 3, 4, 1.302, 103.832),
  createCell('sg-marina-bay', 'C5', '滨海湾 CBD', 'Marina Bay', 'Central', 3, 5, 1.302, 103.880),
  createCell('sg-bedok', 'E4', '勿洛 / 东海岸', 'Bedok & East Coast', 'East', 3, 6, 1.302, 103.928),

  // Row 4 — Southern Islands
  createCell('sg-sentosa', 'C6', '圣淘沙 / 港湾', 'Sentosa & HarbourFront', 'Central', 4, 4, 1.258, 103.832),
];

export function formatSgtTimestamp(baseUtcMs: number, hourOffset: number): {
  isoTime: string;
  sgtLabel: string;
  shortHour: string;
  dayLabel: string;
  sgtHour: number;
} {
  const targetMs = baseUtcMs + hourOffset * 3600_000;
  const isoTime = new Date(targetMs).toISOString();

  // SGT is always UTC+8 (Singapore observes no DST)
  const sgtDate = new Date(targetMs + 8 * 3600_000);
  const baseSgtDate = new Date(baseUtcMs + 8 * 3600_000);

  const sgtDayStart = Date.UTC(
    sgtDate.getUTCFullYear(),
    sgtDate.getUTCMonth(),
    sgtDate.getUTCDate(),
  );
  const baseDayStart = Date.UTC(
    baseSgtDate.getUTCFullYear(),
    baseSgtDate.getUTCMonth(),
    baseSgtDate.getUTCDate(),
  );

  const dayDiff = Math.round((sgtDayStart - baseDayStart) / 86_400_000);
  const dayLabel = dayDiff === 0 ? '今天' : dayDiff === 1 ? '明天' : dayDiff === 2 ? '后天' : `+${dayDiff}日`;
  const sgtHour = sgtDate.getUTCHours();
  const shortHour = `${String(sgtHour).padStart(2, '0')}:00`;

  return {
    isoTime,
    sgtLabel: `${dayLabel} ${shortHour}`,
    shortHour,
    dayLabel,
    sgtHour,
  };
}

export function deriveConditionFromMetrics(
  precipProb: number,
  rainMm: number,
  thunderProb: number,
  cloudCover: number,
): { conditionZh: string; conditionCode: HourlyForecastPoint['conditionCode'] } {
  if (thunderProb >= 45 || (precipProb >= 80 && rainMm >= 6)) {
    return { conditionZh: '雷阵雨', conditionCode: 'THUNDERSTORM' };
  }
  if (precipProb >= 70 || rainMm >= 3.5) {
    return { conditionZh: '中到大雨', conditionCode: 'HEAVY_RAIN' };
  }
  if (precipProb >= 40 || rainMm >= 0.6) {
    return { conditionZh: '阵雨', conditionCode: 'LIGHT_RAIN' };
  }
  if (cloudCover >= 75) {
    return { conditionZh: '多云转阴', conditionCode: 'CLOUDY' };
  }
  if (cloudCover >= 40) {
    return { conditionZh: '多云', conditionCode: 'PARTLY_CLOUDY' };
  }
  return { conditionZh: '晴间多云', conditionCode: 'CLEAR' };
}

/**
 * Deterministic equatorial Singapore 48-hour meteorological model used as
 * offline/hermetic fallback. Models two realistic convective systems:
 *  1) Afternoon convective storm cell building over Central/West around +4h..+9h
 *  2) Northeast/Sumatra squall line sweeping West -> East around +22h..+31h
 */
export function buildFallbackGridForecast(baseTimeIso?: string): GridCellForecast[] {
  const now = baseTimeIso ? new Date(baseTimeIso) : new Date();
  now.setUTCMinutes(0, 0, 0);
  const baseUtcMs = now.getTime();

  return SINGAPORE_GRID_CELLS.map((cell) => {
    const hourly: HourlyForecastPoint[] = [];

    for (let h = 0; h < 48; h++) {
      const ts = formatSgtTimestamp(baseUtcMs, h);
      const nx = (cell.center.lng - 103.64) / 0.36; // 0 (West) -> 1 (East)
      const ny = (1.44 - cell.center.lat) / 0.19; // 0 (North) -> 1 (South)

      // Storm wave 1: Localized afternoon tropical convective cell moving slowly West -> Central
      const wave1PeakHour = 5.5 + nx * 2.8;
      const wave1DistT = Math.abs(h - wave1PeakHour);
      const wave1Spatial = Math.exp(-Math.pow((ny - 0.55) / 0.55, 2));
      const wave1Strength = Math.exp(-Math.pow(wave1DistT / 2.6, 2)) * wave1Spatial * 74;

      // Storm wave 2: Strong Sumatra squall sweeping West -> East on Day 2
      const wave2PeakHour = 23.0 + nx * 4.2;
      const wave2DistT = Math.abs(h - wave2PeakHour);
      const wave2Spatial = 0.88 + 0.12 * Math.cos((ny - 0.4) * Math.PI);
      const wave2Strength = Math.exp(-Math.pow(wave2DistT / 3.1, 2)) * wave2Spatial * 86;

      // Wave 3: Light coastal showers in East/North-East around +39h..+44h
      const wave3PeakHour = 41.0 - nx * 1.4;
      const wave3DistT = Math.abs(h - wave3PeakHour);
      const wave3Strength = Math.exp(-Math.pow(wave3DistT / 2.4, 2)) * (0.55 + 0.45 * nx) * 58;

      // Background tropical humidity oscillation
      const diurnalBase = 14 + 10 * Math.sin(((ts.sgtHour - 9) / 24) * Math.PI * 2);
      const microNoise = ((cell.row * 7 + cell.col * 13 + h * 5) % 9) - 4;

      const precipProb = Math.max(
        5,
        Math.min(98, Math.round(diurnalBase + Math.max(wave1Strength, wave2Strength, wave3Strength) + microNoise)),
      );

      const rainMm =
        precipProb < 35
          ? 0
          : Number(
              (
                Math.pow((precipProb - 30) / 70, 2.2) *
                (precipProb >= 80 ? 14.5 : 7.5)
              ).toFixed(1),
            );

      const thunderProb = Math.max(
        0,
        Math.min(92, Math.round(precipProb > 58 ? (precipProb - 48) * 1.65 : precipProb * 0.18)),
      );

      // Temperature drops slightly during heavy rain
      const diurnalTemp = 28.4 + 3.2 * Math.sin(((ts.sgtHour - 8) / 24) * Math.PI * 2);
      const rainCooling = rainMm > 0 ? Math.min(3.4, rainMm * 0.28) : 0;
      const urbanHeat = cell.region === 'Central' ? 0.6 : cell.region === 'North' ? -0.4 : 0;
      const tempC = Number((diurnalTemp - rainCooling + urbanHeat).toFixed(1));
      const humidity = Math.max(60, Math.min(97, Math.round(70 + precipProb * 0.25 - (tempC - 28) * 2.2)));
      const feelsLikeC = Number((tempC + (humidity - 65) * 0.11).toFixed(1));

      const windKmh = Number(
        (9 + (precipProb > 70 ? (precipProb - 60) * 0.45 : 3 * nx) + ((cell.col + h) % 4)).toFixed(1),
      );
      const windDirection = h >= 20 && h <= 32 ? 'WSW' : 'NE';
      const cloudCover = Math.max(20, Math.min(100, Math.round(32 + precipProb * 0.68)));
      const { conditionZh, conditionCode } = deriveConditionFromMetrics(
        precipProb,
        rainMm,
        thunderProb,
        cloudCover,
      );

      hourly.push({
        hourIndex: h,
        isoTime: ts.isoTime,
        sgtLabel: ts.sgtLabel,
        shortHour: ts.shortHour,
        dayLabel: ts.dayLabel,
        precipProb,
        rainMm,
        thunderProb,
        tempC,
        feelsLikeC,
        humidity,
        windKmh,
        windDirection,
        cloudCover,
        conditionZh,
        conditionCode,
      });
    }

    return {
      ...cell,
      hourly,
    };
  });
}

export function evaluateAlertSeverity(
  point: Pick<HourlyForecastPoint, 'precipProb' | 'rainMm' | 'thunderProb'>,
  rules: AlertRuleConfig,
): AlertSeverity {
  if (
    point.precipProb >= rules.severeThreshold ||
    (point.precipProb >= rules.warningThreshold && point.rainMm >= rules.heavyRainMmThreshold * 1.6)
  ) {
    return 'severe';
  }
  if (
    point.precipProb >= rules.warningThreshold ||
    point.rainMm >= rules.heavyRainMmThreshold ||
    (point.precipProb >= rules.watchThreshold && point.thunderProb >= rules.thunderThreshold)
  ) {
    return 'warning';
  }
  if (point.precipProb >= rules.watchThreshold) {
    return 'watch';
  }
  return 'none';
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  none: 0,
  watch: 1,
  warning: 2,
  severe: 3,
};

function describeTriggerReason(
  peakPrecipProb: number,
  peakRainMm: number,
  peakThunderProb: number,
  rules: AlertRuleConfig,
): string {
  const reasons: string[] = [];
  if (peakPrecipProb >= rules.severeThreshold) {
    reasons.push(`降水概率达 ${peakPrecipProb}%（≥${rules.severeThreshold}% 红色阈值）`);
  } else if (peakPrecipProb >= rules.warningThreshold) {
    reasons.push(`降水概率达 ${peakPrecipProb}%（≥${rules.warningThreshold}% 预警阈值）`);
  } else if (peakPrecipProb >= rules.watchThreshold) {
    reasons.push(`降水概率达 ${peakPrecipProb}%（≥${rules.watchThreshold}% 关注阈值）`);
  }

  if (peakRainMm >= rules.heavyRainMmThreshold) {
    reasons.push(`短时强降雨 ${peakRainMm.toFixed(1)} mm/h`);
  }
  if (peakThunderProb >= rules.thunderThreshold) {
    reasons.push(`伴随雷暴风险 ${peakThunderProb}%`);
  }
  return reasons.join(' · ') || `降水概率 ${peakPrecipProb}%`;
}

/**
 * Extracts contiguous 48-hour precipitation warning windows across Singapore grid cells.
 */
export function extractAlertWindows(
  cells: GridCellForecast[],
  rules: AlertRuleConfig,
  watchlistIds: string[] = [],
): PrecipitationAlertWindow[] {
  const watchlistSet = new Set(watchlistIds);
  const activeCells = rules.watchlistOnly
    ? cells.filter((cell) => watchlistSet.has(cell.id))
    : cells;

  const windows: PrecipitationAlertWindow[] = [];

  for (const cell of activeCells) {
    let currentStart = -1;
    let peakIdx = -1;
    let maxSeverity: AlertSeverity = 'none';
    let peakProb = 0;
    let peakRain = 0;
    let peakThunder = 0;

    const flushWindow = (endIdx: number) => {
      if (currentStart === -1 || maxSeverity === 'none' || peakIdx === -1) return;
      const startPt = cell.hourly[currentStart];
      const endPt = cell.hourly[endIdx];
      const peakPt = cell.hourly[peakIdx];
      windows.push({
        id: `${cell.id}-${currentStart}-${endIdx}`,
        cellId: cell.id,
        cellNameZh: cell.nameZh,
        cellNameEn: cell.nameEn,
        region: cell.region,
        regionZh: cell.regionZh,
        severity: maxSeverity,
        startHourIndex: currentStart,
        endHourIndex: endIdx,
        peakHourIndex: peakIdx,
        startSgtLabel: startPt.sgtLabel,
        endSgtLabel: endPt.sgtLabel,
        peakSgtLabel: peakPt.sgtLabel,
        durationHours: endIdx - currentStart + 1,
        peakPrecipProb: peakProb,
        peakRainMm: Number(peakRain.toFixed(1)),
        peakThunderProb: peakThunder,
        triggerReason: describeTriggerReason(peakProb, peakRain, peakThunder, rules),
      });
    };

    for (let i = 0; i < cell.hourly.length; i++) {
      const pt = cell.hourly[i];
      const sev = evaluateAlertSeverity(pt, rules);

      if (sev !== 'none') {
        if (currentStart === -1) {
          currentStart = i;
          peakIdx = i;
          maxSeverity = sev;
          peakProb = pt.precipProb;
          peakRain = pt.rainMm;
          peakThunder = pt.thunderProb;
        } else {
          if (SEVERITY_RANK[sev] > SEVERITY_RANK[maxSeverity]) {
            maxSeverity = sev;
          }
          if (pt.precipProb > peakProb || (pt.precipProb === peakProb && pt.rainMm > peakRain)) {
            peakIdx = i;
            peakProb = pt.precipProb;
          }
          if (pt.rainMm > peakRain) peakRain = pt.rainMm;
          if (pt.thunderProb > peakThunder) peakThunder = pt.thunderProb;
        }
      } else if (currentStart !== -1) {
        flushWindow(i - 1);
        currentStart = -1;
        peakIdx = -1;
        maxSeverity = 'none';
        peakProb = 0;
        peakRain = 0;
        peakThunder = 0;
      }
    }

    if (currentStart !== -1) {
      flushWindow(cell.hourly.length - 1);
    }
  }

  return windows.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;
    if (b.peakPrecipProb !== a.peakPrecipProb) return b.peakPrecipProb - a.peakPrecipProb;
    return a.startHourIndex - b.startHourIndex;
  });
}

export interface HourSnapshotSummary {
  hourIndex: number;
  sgtLabel: string;
  maxPrecipProb: number;
  avgPrecipProb: number;
  maxRainMm: number;
  avgTempC: number;
  severeCount: number;
  warningCount: number;
  watchCount: number;
  hotspotCellId: string;
  hotspotNameZh: string;
}

export function summarizeHourSnapshot(
  cells: GridCellForecast[],
  hourIndex: number,
  rules: AlertRuleConfig,
): HourSnapshotSummary {
  const safeHour = Math.max(0, Math.min(47, hourIndex));
  if (cells.length === 0) {
    return {
      hourIndex: safeHour,
      sgtLabel: '',
      maxPrecipProb: 0,
      avgPrecipProb: 0,
      maxRainMm: 0,
      avgTempC: 0,
      severeCount: 0,
      warningCount: 0,
      watchCount: 0,
      hotspotCellId: '',
      hotspotNameZh: '',
    };
  }

  let maxPrecipProb = -1;
  let sumPrecipProb = 0;
  let maxRainMm = 0;
  let sumTemp = 0;
  let severeCount = 0;
  let warningCount = 0;
  let watchCount = 0;
  let hotspotCell = cells[0];

  for (const cell of cells) {
    const pt = cell.hourly[safeHour] ?? cell.hourly[0];
    sumPrecipProb += pt.precipProb;
    sumTemp += pt.tempC;
    if (pt.rainMm > maxRainMm) maxRainMm = pt.rainMm;
    if (pt.precipProb > maxPrecipProb) {
      maxPrecipProb = pt.precipProb;
      hotspotCell = cell;
    }

    const sev = evaluateAlertSeverity(pt, rules);
    if (sev === 'severe') severeCount++;
    else if (sev === 'warning') warningCount++;
    else if (sev === 'watch') watchCount++;
  }

  return {
    hourIndex: safeHour,
    sgtLabel: cells[0].hourly[safeHour]?.sgtLabel ?? '',
    maxPrecipProb: Math.max(0, maxPrecipProb),
    avgPrecipProb: Math.round(sumPrecipProb / cells.length),
    maxRainMm: Number(maxRainMm.toFixed(1)),
    avgTempC: Number((sumTemp / cells.length).toFixed(1)),
    severeCount,
    warningCount,
    watchCount,
    hotspotCellId: hotspotCell.id,
    hotspotNameZh: hotspotCell.nameZh,
  };
}

export function findPeakRiskHour(cells: GridCellForecast[]): {
  hourIndex: number;
  cellId: string;
  peakPrecipProb: number;
} {
  let bestHour = 0;
  let bestCellId = cells[0]?.id ?? 'sg-marina-bay';
  let bestProb = -1;
  let bestRain = -1;

  for (const cell of cells) {
    for (const pt of cell.hourly) {
      if (pt.precipProb > bestProb || (pt.precipProb === bestProb && pt.rainMm > bestRain)) {
        bestProb = pt.precipProb;
        bestRain = pt.rainMm;
        bestHour = pt.hourIndex;
        bestCellId = cell.id;
      }
    }
  }

  return {
    hourIndex: bestHour,
    cellId: bestCellId,
    peakPrecipProb: Math.max(0, bestProb),
  };
}

export interface LayerColorSpec {
  fillHex: string;
  fillOpacity: number;
  strokeHex: string;
  textClass: string;
  cellBgClass: string;
  formattedValue: string;
}

export function getLayerColorSpec(
  point: HourlyForecastPoint,
  layer: WeatherLayer,
): LayerColorSpec {
  if (layer === 'precipProb') {
    const p = point.precipProb;
    if (p >= 85) {
      return {
        fillHex: '#dc2626',
        fillOpacity: 0.62,
        strokeHex: '#991b1b',
        textClass: 'text-white',
        cellBgClass: 'bg-red-600 text-white',
        formattedValue: `${p}%`,
      };
    }
    if (p >= 70) {
      return {
        fillHex: '#ea580c',
        fillOpacity: 0.56,
        strokeHex: '#9a3412',
        textClass: 'text-white',
        cellBgClass: 'bg-orange-500 text-white',
        formattedValue: `${p}%`,
      };
    }
    if (p >= 50) {
      return {
        fillHex: '#2563eb',
        fillOpacity: 0.48,
        strokeHex: '#1d4ed8',
        textClass: 'text-white',
        cellBgClass: 'bg-blue-600 text-white',
        formattedValue: `${p}%`,
      };
    }
    if (p >= 30) {
      return {
        fillHex: '#38bdf8',
        fillOpacity: 0.36,
        strokeHex: '#0284c7',
        textClass: 'text-slate-900',
        cellBgClass: 'bg-sky-200 text-slate-900',
        formattedValue: `${p}%`,
      };
    }
    return {
      fillHex: '#94a3b8',
      fillOpacity: 0.16,
      strokeHex: '#64748b',
      textClass: 'text-slate-700',
      cellBgClass: 'bg-slate-100 text-slate-600',
      formattedValue: `${p}%`,
    };
  }

  if (layer === 'rainMm') {
    const r = point.rainMm;
    if (r >= 8) {
      return {
        fillHex: '#be123c',
        fillOpacity: 0.62,
        strokeHex: '#881337',
        textClass: 'text-white',
        cellBgClass: 'bg-rose-700 text-white',
        formattedValue: `${r.toFixed(1)}`,
      };
    }
    if (r >= 4) {
      return {
        fillHex: '#1d4ed8',
        fillOpacity: 0.54,
        strokeHex: '#1e3a8a',
        textClass: 'text-white',
        cellBgClass: 'bg-blue-700 text-white',
        formattedValue: `${r.toFixed(1)}`,
      };
    }
    if (r >= 1) {
      return {
        fillHex: '#0ea5e9',
        fillOpacity: 0.4,
        strokeHex: '#0369a1',
        textClass: 'text-slate-900',
        cellBgClass: 'bg-sky-300 text-slate-900',
        formattedValue: `${r.toFixed(1)}`,
      };
    }
    return {
      fillHex: '#cbd5e1',
      fillOpacity: 0.14,
      strokeHex: '#94a3b8',
      textClass: 'text-slate-500',
      cellBgClass: 'bg-slate-50 text-slate-500',
      formattedValue: `${r.toFixed(1)}`,
    };
  }

  if (layer === 'tempC') {
    const t = point.tempC;
    if (t >= 32) {
      return {
        fillHex: '#dc2626',
        fillOpacity: 0.5,
        strokeHex: '#991b1b',
        textClass: 'text-white',
        cellBgClass: 'bg-red-500 text-white',
        formattedValue: `${t.toFixed(1)}°`,
      };
    }
    if (t >= 30) {
      return {
        fillHex: '#f59e0b',
        fillOpacity: 0.44,
        strokeHex: '#b45309',
        textClass: 'text-slate-900',
        cellBgClass: 'bg-amber-300 text-slate-900',
        formattedValue: `${t.toFixed(1)}°`,
      };
    }
    if (t >= 27) {
      return {
        fillHex: '#10b981',
        fillOpacity: 0.34,
        strokeHex: '#047857',
        textClass: 'text-slate-900',
        cellBgClass: 'bg-emerald-200 text-slate-900',
        formattedValue: `${t.toFixed(1)}°`,
      };
    }
    return {
      fillHex: '#06b6d4',
      fillOpacity: 0.34,
      strokeHex: '#0e7490',
      textClass: 'text-slate-900',
      cellBgClass: 'bg-cyan-200 text-slate-900',
      formattedValue: `${t.toFixed(1)}°`,
    };
  }

  // windKmh
  const w = point.windKmh;
  if (w >= 25) {
    return {
      fillHex: '#7c3aed',
      fillOpacity: 0.52,
      strokeHex: '#5b21b6',
      textClass: 'text-white',
      cellBgClass: 'bg-violet-600 text-white',
      formattedValue: `${Math.round(w)}`,
    };
  }
  if (w >= 16) {
    return {
      fillHex: '#0d9488',
      fillOpacity: 0.44,
      strokeHex: '#115e59',
      textClass: 'text-white',
      cellBgClass: 'bg-teal-500 text-white',
      formattedValue: `${Math.round(w)}`,
    };
  }
  return {
    fillHex: '#94a3b8',
    fillOpacity: 0.22,
    strokeHex: '#64748b',
    textClass: 'text-slate-700',
    cellBgClass: 'bg-slate-200 text-slate-700',
    formattedValue: `${Math.round(w)}`,
  };
}

export function getSeverityMeta(severity: AlertSeverity): {
  label: string;
  symbol: string;
  textClass: string;
  surfaceClass: string;
  borderClass: string;
} {
  switch (severity) {
    case 'severe':
      return {
        label: '红色暴雨高风险',
        symbol: '✖',
        textClass: 'text-red-700',
        surfaceClass: 'bg-red-50',
        borderClass: 'border-red-200',
      };
    case 'warning':
      return {
        label: '橙色降水预警',
        symbol: '▲',
        textClass: 'text-orange-700',
        surfaceClass: 'bg-orange-50',
        borderClass: 'border-orange-200',
      };
    case 'watch':
      return {
        label: '蓝色降水关注',
        symbol: '◆',
        textClass: 'text-blue-700',
        surfaceClass: 'bg-blue-50',
        borderClass: 'border-blue-200',
      };
    default:
      return {
        label: '天气平稳',
        symbol: '●',
        textClass: 'text-emerald-700',
        surfaceClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200',
      };
  }
}
