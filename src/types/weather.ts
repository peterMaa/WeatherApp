export type SingaporeRegion = 'Central' | 'North' | 'North-East' | 'East' | 'West';

export type WeatherLayer = 'precipProb' | 'rainMm' | 'tempC' | 'windKmh';

export type AlertSeverity = 'none' | 'watch' | 'warning' | 'severe';

export interface GridBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GridCellDefinition {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  region: SingaporeRegion;
  regionZh: string;
  row: number;
  col: number;
  center: {
    lat: number;
    lng: number;
  };
  bounds: GridBounds;
}

export interface HourlyForecastPoint {
  hourIndex: number; // 0..47
  isoTime: string;
  sgtLabel: string; // e.g. "今日 14:00" or "明日 08:00"
  shortHour: string; // e.g. "14:00"
  dayLabel: string; // e.g. "今天" | "明天" | "后天"
  precipProb: number; // 0..100 (%)
  rainMm: number; // mm/h
  thunderProb: number; // 0..100 (%)
  tempC: number; // °C
  feelsLikeC: number; // °C
  humidity: number; // 0..100 (%)
  windKmh: number; // km/h
  windDirection: string; // e.g. "NE"
  cloudCover: number; // 0..100 (%)
  conditionZh: string;
  conditionCode: 'CLEAR' | 'PARTLY_CLOUDY' | 'CLOUDY' | 'LIGHT_RAIN' | 'HEAVY_RAIN' | 'THUNDERSTORM';
}

export interface GridCellForecast extends GridCellDefinition {
  hourly: HourlyForecastPoint[];
}

export interface AlertRuleConfig {
  watchThreshold: number; // % e.g. 50
  warningThreshold: number; // % e.g. 70
  severeThreshold: number; // % e.g. 85
  heavyRainMmThreshold: number; // mm/h e.g. 5.0
  thunderThreshold: number; // % e.g. 45
  watchlistOnly: boolean;
}

export interface PrecipitationAlertWindow {
  id: string;
  cellId: string;
  cellNameZh: string;
  cellNameEn: string;
  region: SingaporeRegion;
  regionZh: string;
  severity: Exclude<AlertSeverity, 'none'>;
  startHourIndex: number;
  endHourIndex: number;
  peakHourIndex: number;
  startSgtLabel: string;
  endSgtLabel: string;
  peakSgtLabel: string;
  durationHours: number;
  peakPrecipProb: number;
  peakRainMm: number;
  peakThunderProb: number;
  triggerReason: string;
}

export interface OfficialPublicAlert {
  alertId: string;
  title: string;
  eventType: string;
  areaName: string;
  description?: string;
  severity?: string;
  urgency?: string;
  startTime?: string;
  expirationTime?: string;
  instructions: string[];
  dataSource: {
    publisher?: string;
    name: string;
    authorityUri: string;
  };
}

export interface WeatherGridApiResponse {
  generatedAt: string;
  sourceLabel: string;
  sourceType: 'google-weather-hybrid' | 'open-meteo' | 'deterministic-fallback';
  quotaExceeded?: boolean;
  cells: GridCellForecast[];
  publicAlerts: OfficialPublicAlert[];
}

export interface GroundingPlaceLink {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export interface MapsGroundingResponse {
  text: string;
  places: GroundingPlaceLink[];
  model: string;
  locationLabel: string;
  generatedAt: string;
}
