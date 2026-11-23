import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import {
  SINGAPORE_GRID_CELLS,
  buildFallbackGridForecast,
  deriveConditionFromMetrics,
  formatSgtTimestamp,
} from './src/utils/weatherGrid.ts';
import type {
  GridCellForecast,
  GroundingPlaceLink,
  HourlyForecastPoint,
  OfficialPublicAlert,
  WeatherGridApiResponse,
} from './src/types/weather.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';
const CACHE_TTL_MS = 15 * 60 * 1000;

let cachedWeatherPayload: { timestamp: number; data: WeatherGridApiResponse } | null = null;

function getMapsApiKey(): string {
  return (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

function cardinalFromDegrees(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 45) % 8];
}

function shortCardinal(cardinal?: string, degrees?: number): string {
  if (typeof degrees === 'number' && !Number.isNaN(degrees)) {
    return cardinalFromDegrees(degrees);
  }
  if (!cardinal) return 'NE';
  const map: Record<string, string> = {
    NORTH: 'N',
    NORTH_NORTHEAST: 'NE',
    NORTHEAST: 'NE',
    EAST_NORTHEAST: 'NE',
    EAST: 'E',
    EAST_SOUTHEAST: 'SE',
    SOUTHEAST: 'SE',
    SOUTH_SOUTHEAST: 'SE',
    SOUTH: 'S',
    SOUTH_SOUTHWEST: 'SW',
    SOUTHWEST: 'SW',
    WEST_SOUTHWEST: 'SW',
    WEST: 'W',
    WEST_NORTHWEST: 'NW',
    NORTHWEST: 'NW',
    NORTH_NORTHWEST: 'NW',
  };
  return map[cardinal] ?? 'NE';
}

interface AnchorHourlySlice {
  startTime: string;
  precipProb: number;
  rainMm: number;
  thunderProb: number;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  windDirection: string;
  cloudCover: number;
}

async function fetchGoogleWeatherHours(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<{ hours: AnchorHourlySlice[]; quotaExceeded: boolean }> {
  const collected: AnchorHourlySlice[] = [];
  let pageToken: string | null = null;
  let pages = 0;

  while (pages < 2 && collected.length < 48) {
    pages++;
    const url = new URL('https://weather.googleapis.com/v1/forecast/hours:lookup');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('location.latitude', String(lat));
    url.searchParams.set('location.longitude', String(lng));
    url.searchParams.set('hours', '48');
    url.searchParams.set('pageSize', '24');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const res = await fetch(url.toString(), {
        headers: { 'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID },
        signal: controller.signal,
      });

      if (res.status === 429) {
        return { hours: [], quotaExceeded: true };
      }

      const raw = (await res.json().catch(() => null)) as Record<string, any> | null;
      if (!res.ok) {
        const statusCode = raw?.error?.status;
        if (statusCode === 'RESOURCE_EXHAUSTED') {
          return { hours: [], quotaExceeded: true };
        }
        return { hours: [], quotaExceeded: false };
      }

      const list = Array.isArray(raw?.forecastHours) ? raw.forecastHours : [];
      for (const item of list) {
        if (collected.length >= 48) break;
        collected.push({
          startTime: item?.interval?.startTime ?? new Date().toISOString(),
          precipProb: Math.max(0, Math.min(100, Math.round(item?.precipitation?.probability?.percent ?? 0))),
          rainMm: Number((item?.precipitation?.qpf?.quantity ?? 0).toFixed(1)),
          thunderProb: Math.max(0, Math.min(100, Math.round(item?.thunderstormProbability ?? 0))),
          tempC: Number((item?.temperature?.degrees ?? 29.0).toFixed(1)),
          feelsLikeC: Number((item?.feelsLikeTemperature?.degrees ?? item?.temperature?.degrees ?? 31.5).toFixed(1)),
          humidity: Math.max(0, Math.min(100, Math.round(item?.relativeHumidity ?? 78))),
          windKmh: Number((item?.wind?.speed?.value ?? 11).toFixed(1)),
          windDirection: shortCardinal(item?.wind?.direction?.cardinal, item?.wind?.direction?.degrees),
          cloudCover: Math.max(0, Math.min(100, Math.round(item?.cloudCover ?? 55))),
        });
      }

      pageToken = typeof raw?.nextPageToken === 'string' ? raw.nextPageToken : null;
      if (!pageToken) break;
    } catch {
      return { hours: [], quotaExceeded: false };
    } finally {
      clearTimeout(timer);
    }
  }

  return { hours: collected, quotaExceeded: false };
}

async function fetchGooglePublicAlerts(
  apiKey: string,
): Promise<{ alerts: OfficialPublicAlert[]; quotaExceeded: boolean }> {
  if (!apiKey) return { alerts: [], quotaExceeded: false };

  const url = new URL('https://weather.googleapis.com/v1/publicAlerts:lookup');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location.latitude', '1.3521');
  url.searchParams.set('location.longitude', '103.8198');
  url.searchParams.set('languageCode', 'zh-CN');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Goog-Maps-Solution-ID': GMP_ATTRIBUTION_ID },
      signal: controller.signal,
    });
    if (res.status === 429) {
      return { alerts: [], quotaExceeded: true };
    }
    const raw = (await res.json().catch(() => null)) as Record<string, any> | null;
    if (!res.ok) {
      if (raw?.error?.status === 'RESOURCE_EXHAUSTED') {
        return { alerts: [], quotaExceeded: true };
      }
      return { alerts: [], quotaExceeded: false };
    }

    const alertsList = Array.isArray(raw?.weatherAlerts) ? raw.weatherAlerts : [];
    const mapped: OfficialPublicAlert[] = alertsList.map((a: any) => ({
      alertId: String(a.alertId ?? Math.random().toString(36).slice(2)),
      title: String(a.alertTitle?.text ?? a.eventType ?? '气象预警'),
      eventType: String(a.eventType ?? 'WEATHER_ALERT'),
      areaName: String(a.areaName ?? 'Singapore'),
      description: typeof a.description === 'string' ? a.description : undefined,
      severity: typeof a.severity === 'string' ? a.severity : undefined,
      urgency: typeof a.urgency === 'string' ? a.urgency : undefined,
      startTime: typeof a.startTime === 'string' ? a.startTime : undefined,
      expirationTime: typeof a.expirationTime === 'string' ? a.expirationTime : undefined,
      instructions: Array.isArray(a.instruction) ? a.instruction.map(String) : [],
      dataSource: {
        publisher: a.dataSource?.publisher ? String(a.dataSource.publisher) : undefined,
        name: String(a.dataSource?.name ?? 'Meteorological Service Singapore'),
        authorityUri: String(a.dataSource?.authorityUri ?? 'https://www.weather.gov.sg/'),
      },
    }));

    return { alerts: mapped, quotaExceeded: false };
  } catch {
    return { alerts: [], quotaExceeded: false };
  } finally {
    clearTimeout(timer);
  }
}

function interpolateAnchorsToGrid(
  anchors: Array<{ lat: number; lng: number; hours: AnchorHourlySlice[] }>,
): GridCellForecast[] {
  const firstStartMs = Date.parse(anchors[0].hours[0].startTime) || Date.now();

  return SINGAPORE_GRID_CELLS.map((cell) => {
    const weights = anchors.map((anchor) => {
      const dLat = cell.center.lat - anchor.lat;
      const dLng = cell.center.lng - anchor.lng;
      const distSq = dLat * dLat + dLng * dLng;
      return 1 / (distSq + 0.0004);
    });
    const weightSum = weights.reduce((acc, w) => acc + w, 0);

    const hourly: HourlyForecastPoint[] = [];
    for (let h = 0; h < 48; h++) {
      const ts = formatSgtTimestamp(firstStartMs, h);
      let precipProb = 0;
      let rainMm = 0;
      let thunderProb = 0;
      let tempC = 0;
      let feelsLikeC = 0;
      let humidity = 0;
      let windKmh = 0;
      let cloudCover = 0;

      anchors.forEach((anchor, idx) => {
        const w = weights[idx] / weightSum;
        const slice = anchor.hours[h] ?? anchor.hours[anchor.hours.length - 1];
        precipProb += slice.precipProb * w;
        rainMm += slice.rainMm * w;
        thunderProb += slice.thunderProb * w;
        tempC += slice.tempC * w;
        feelsLikeC += slice.feelsLikeC * w;
        humidity += slice.humidity * w;
        windKmh += slice.windKmh * w;
        cloudCover += slice.cloudCover * w;
      });

      // Slight coastal/urban micro-gradient for realistic grid variation
      const microBias = ((cell.row * 3 + cell.col * 5 + h) % 5) - 2;
      const finalProb = Math.max(0, Math.min(100, Math.round(precipProb + microBias)));
      const finalRain = Number(Math.max(0, rainMm).toFixed(1));
      const finalThunder = Math.max(0, Math.min(100, Math.round(thunderProb)));
      const finalCloud = Math.max(0, Math.min(100, Math.round(cloudCover)));
      const { conditionZh, conditionCode } = deriveConditionFromMetrics(
        finalProb,
        finalRain,
        finalThunder,
        finalCloud,
      );

      hourly.push({
        hourIndex: h,
        isoTime: ts.isoTime,
        sgtLabel: ts.sgtLabel,
        shortHour: ts.shortHour,
        dayLabel: ts.dayLabel,
        precipProb: finalProb,
        rainMm: finalRain,
        thunderProb: finalThunder,
        tempC: Number(tempC.toFixed(1)),
        feelsLikeC: Number(feelsLikeC.toFixed(1)),
        humidity: Math.max(0, Math.min(100, Math.round(humidity))),
        windKmh: Number(windKmh.toFixed(1)),
        windDirection: anchors[1]?.hours[h]?.windDirection ?? anchors[0].hours[h]?.windDirection ?? 'NE',
        cloudCover: finalCloud,
        conditionZh,
        conditionCode,
      });
    }

    return { ...cell, hourly };
  });
}

async function fetchOpenMeteoGrid(): Promise<GridCellForecast[] | null> {
  const lats = SINGAPORE_GRID_CELLS.map((c) => c.center.lat.toFixed(4)).join(',');
  const lngs = SINGAPORE_GRID_CELLS.map((c) => c.center.lng.toFixed(4)).join(',');
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code` +
    `&forecast_hours=48&timezone=UTC`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const raw = (await res.json()) as any;
    const items: any[] = Array.isArray(raw) ? raw : [raw];
    if (items.length !== SINGAPORE_GRID_CELLS.length) return null;

    const firstTime = items[0]?.hourly?.time?.[0];
    const baseUtcMs = firstTime ? Date.parse(`${firstTime}Z`) : Date.now();

    return SINGAPORE_GRID_CELLS.map((cell, idx) => {
      const hObj = items[idx]?.hourly;
      const hourly: HourlyForecastPoint[] = [];

      for (let h = 0; h < 48; h++) {
        const ts = formatSgtTimestamp(baseUtcMs, h);
        const precipProb = Math.max(
          0,
          Math.min(100, Math.round(Number(hObj?.precipitation_probability?.[h] ?? 0))),
        );
        const rainMm = Number(Math.max(0, Number(hObj?.precipitation?.[h] ?? 0)).toFixed(1));
        const wmo = Number(hObj?.weather_code?.[h] ?? 0);
        const thunderProb =
          wmo >= 95 ? Math.max(65, precipProb) : precipProb >= 70 ? Math.round((precipProb - 45) * 1.4) : Math.round(precipProb * 0.2);
        const cloudCover = Math.max(0, Math.min(100, Math.round(Number(hObj?.cloud_cover?.[h] ?? 50))));
        const tempC = Number(Number(hObj?.temperature_2m?.[h] ?? 29).toFixed(1));
        const feelsLikeC = Number(Number(hObj?.apparent_temperature?.[h] ?? tempC + 2.5).toFixed(1));
        const humidity = Math.max(0, Math.min(100, Math.round(Number(hObj?.relative_humidity_2m?.[h] ?? 78))));
        const windKmh = Number(Number(hObj?.wind_speed_10m?.[h] ?? 10).toFixed(1));
        const windDeg = Number(hObj?.wind_direction_10m?.[h] ?? 45);
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
          thunderProb: Math.max(0, Math.min(100, thunderProb)),
          tempC,
          feelsLikeC,
          humidity,
          windKmh,
          windDirection: cardinalFromDegrees(windDeg),
          cloudCover,
          conditionZh,
          conditionCode,
        });
      }

      return { ...cell, hourly };
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveWeatherGrid(forceRefresh = false): Promise<WeatherGridApiResponse> {
  if (!forceRefresh && cachedWeatherPayload && Date.now() - cachedWeatherPayload.timestamp < CACHE_TTL_MS) {
    return cachedWeatherPayload.data;
  }

  const mapsApiKey = getMapsApiKey();
  let quotaExceeded = false;
  let publicAlerts: OfficialPublicAlert[] = [];

  if (mapsApiKey) {
    const alertRes = await fetchGooglePublicAlerts(mapsApiKey);
    publicAlerts = alertRes.alerts;
    if (alertRes.quotaExceeded) quotaExceeded = true;
  }

  // Primary: Try Google Maps Platform Weather API across 3 Singapore regional anchors (West / Central / East)
  if (mapsApiKey && !quotaExceeded) {
    const anchorCoords = [
      { lat: 1.346, lng: 103.688 }, // West (Jurong / Boon Lay)
      { lat: 1.335, lng: 103.832 }, // Central (Orchard / Bishan)
      { lat: 1.346, lng: 103.976 }, // East (Changi)
    ];

    const anchorResults = await Promise.all(
      anchorCoords.map(async (pt) => {
        const res = await fetchGoogleWeatherHours(pt.lat, pt.lng, mapsApiKey);
        return { ...pt, ...res };
      }),
    );

    if (anchorResults.some((r) => r.quotaExceeded)) {
      quotaExceeded = true;
    }

    const validAnchors = anchorResults.filter((r) => r.hours.length >= 24);
    if (validAnchors.length >= 2) {
      const cells = interpolateAnchorsToGrid(
        validAnchors.map((a) => ({ lat: a.lat, lng: a.lng, hours: a.hours })),
      );
      const payload: WeatherGridApiResponse = {
        generatedAt: new Date().toISOString(),
        sourceLabel: 'Google Maps Platform Weather API（新加坡三轴锚点格网插值）',
        sourceType: 'google-weather-hybrid',
        quotaExceeded,
        cells,
        publicAlerts,
      };
      cachedWeatherPayload = { timestamp: Date.now(), data: payload };
      return payload;
    }
  }

  // Secondary: Real-time 26-point Singapore ECMWF/GFS grid via Open-Meteo
  const openMeteoCells = await fetchOpenMeteoGrid();
  if (openMeteoCells) {
    const payload: WeatherGridApiResponse = {
      generatedAt: new Date().toISOString(),
      sourceLabel: 'Open-Meteo 新加坡 26 格点实况融合预报',
      sourceType: 'open-meteo',
      quotaExceeded,
      cells: openMeteoCells,
      publicAlerts,
    };
    cachedWeatherPayload = { timestamp: Date.now(), data: payload };
    return payload;
  }

  // Deterministic tropical monsoon convective fallback (offline / hermetic environments)
  const fallbackCells = buildFallbackGridForecast();
  const payload: WeatherGridApiResponse = {
    generatedAt: new Date().toISOString(),
    sourceLabel: '新加坡赤道对流格网基准模型（离线演示数据）',
    sourceType: 'deterministic-fallback',
    quotaExceeded,
    cells: fallbackCells,
    publicAlerts,
  };
  cachedWeatherPayload = { timestamp: Date.now(), data: payload };
  return payload;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured on the server.'), { status: 503 });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/maps-config', (_req, res) => {
    res.json({
      mapsApiKey: getMapsApiKey(),
    });
  });

  app.get('/api/weather/grid', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1';
      const data = await resolveWeatherGrid(forceRefresh);
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Singapore weather grid.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/maps-grounding/advisory', async (req, res) => {
    try {
      const { lat, lng, cellNameZh, cellNameEn, prompt, weatherSummary } = req.body ?? {};
      const latitude = Number(lat);
      const longitude = Number(lng);

      if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude) ||
        latitude < 1.1 ||
        latitude > 1.6 ||
        longitude < 103.5 ||
        longitude > 104.2
      ) {
        return res.status(400).json({ error: '请提供有效的新加坡区域经纬度坐标。' });
      }

      const userQuery =
        typeof prompt === 'string' && prompt.trim().length > 0
          ? prompt.trim().slice(0, 400)
          : '推荐该区域内带遮雨连廊的地铁站、室内综合体及短时强降水避雨出行建议。';

      const ai = getGeminiClient();
      const locationLabel = `${String(cellNameZh || '新加坡')} (${String(cellNameEn || 'Singapore')})`;

      const fullPrompt = [
        `你是一名熟悉新加坡本地地理、地铁网络（MRT）、有盖连廊与极端短时强降雨应对的气象出行参谋。`,
        `当前选中气象格网：${locationLabel}，坐标 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})。`,
        weatherSummary ? `48小时气象预警摘要：${String(weatherSummary).slice(0, 500)}` : '',
        `用户需求：${userQuery}`,
        `请结合 Google Maps 真实地点数据，用简洁、结构化的中文分点回答，列出 3–5 个距离该坐标最近的真实新加坡地点（如 MRT 地铁站、大型室内商场、社区中心或交通枢纽），并给出针对当前降水风险的实用通勤与防雨建议。`,
      ]
        .filter(Boolean)
        .join('\n');

      const callGemini = async () =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: fullPrompt,
          config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
              retrievalConfig: {
                latLng: {
                  latitude,
                  longitude,
                },
              },
            },
          },
        });

      let response;
      try {
        response = await callGemini();
      } catch (firstErr: any) {
        if (firstErr?.status === 503) {
          await new Promise((r) => setTimeout(r, 900));
          response = await callGemini();
        } else {
          throw firstErr;
        }
      }

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const places: GroundingPlaceLink[] = [];

      for (const chunk of chunks as any[]) {
        const mapsInfo = chunk?.maps;
        if (!mapsInfo?.uri || seenUris.has(mapsInfo.uri)) continue;
        seenUris.add(mapsInfo.uri);

        const snippets: string[] = [];
        const rawSnippets = mapsInfo.placeAnswerSources?.reviewSnippets;
        if (Array.isArray(rawSnippets)) {
          for (const s of rawSnippets) {
            if (typeof s === 'string' && s.trim()) {
              snippets.push(s.trim());
            } else if (typeof s?.content === 'string' && s.content.trim()) {
              snippets.push(s.content.trim());
            }
          }
        }

        places.push({
          title: String(mapsInfo.title || 'Google Maps 地点'),
          uri: String(mapsInfo.uri),
          reviewSnippets: snippets.length > 0 ? snippets : undefined,
        });
      }

      return res.json({
        text: response.text || '暂未生成地点建议，请稍后重试。',
        places,
        model: 'gemini-4-hydrogen',
        locationLabel,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 500;
      const rawMessage = err instanceof Error ? err.message : 'Google Maps Grounding 请求失败。';
      const friendlyMessage =
        status === 403 || rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('PERMISSION_DENIED')
          ? 'Gemini API 密钥无效或无权限，请在 Settings > Secrets 面板检查配置。'
          : status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')
            ? 'Gemini API 配额已达上限，请稍后再试或在 Settings > Secrets 切换账单密钥。'
            : rawMessage;
      return res.status(status >= 400 && status < 600 ? status : 500).json({
        error: friendlyMessage,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SG MeteoGrid server running at http://localhost:${PORT}`);
  });
}

startServer();
