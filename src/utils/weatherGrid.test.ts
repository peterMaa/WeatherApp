import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SINGAPORE_GRID_CELLS,
  DEFAULT_ALERT_RULES,
  buildFallbackGridForecast,
  evaluateAlertSeverity,
  extractAlertWindows,
  summarizeHourSnapshot,
  findPeakRiskHour,
  formatSgtTimestamp,
} from './weatherGrid';

test('Singapore grid cells stay within Singapore geographic bounds and have unique IDs', () => {
  assert.ok(SINGAPORE_GRID_CELLS.length >= 24);
  const ids = new Set<string>();
  for (const cell of SINGAPORE_GRID_CELLS) {
    assert.equal(ids.has(cell.id), false, `Duplicate cell id: ${cell.id}`);
    ids.add(cell.id);
    assert.ok(cell.center.lat >= 1.22 && cell.center.lat <= 1.47, `Lat out of SG range: ${cell.id}`);
    assert.ok(cell.center.lng >= 103.60 && cell.center.lng <= 104.05, `Lng out of SG range: ${cell.id}`);
    assert.ok(cell.bounds.north > cell.bounds.south);
    assert.ok(cell.bounds.east > cell.bounds.west);
  }
});

test('fallback forecast produces 48 valid hourly slices for every cell', () => {
  const cells = buildFallbackGridForecast('2026-11-23T06:00:00.000Z');
  assert.equal(cells.length, SINGAPORE_GRID_CELLS.length);
  for (const cell of cells) {
    assert.equal(cell.hourly.length, 48);
    for (let h = 0; h < 48; h++) {
      const pt = cell.hourly[h];
      assert.equal(pt.hourIndex, h);
      assert.ok(pt.precipProb >= 0 && pt.precipProb <= 100);
      assert.ok(pt.rainMm >= 0);
      assert.ok(pt.tempC >= 20 && pt.tempC <= 40);
    }
  }
});

test('evaluateAlertSeverity classifies none, watch, warning, and severe accurately', () => {
  assert.equal(
    evaluateAlertSeverity({ precipProb: 35, rainMm: 0, thunderProb: 10 }, DEFAULT_ALERT_RULES),
    'none',
  );
  assert.equal(
    evaluateAlertSeverity({ precipProb: 55, rainMm: 1.2, thunderProb: 20 }, DEFAULT_ALERT_RULES),
    'watch',
  );
  assert.equal(
    evaluateAlertSeverity({ precipProb: 74, rainMm: 2.5, thunderProb: 30 }, DEFAULT_ALERT_RULES),
    'warning',
  );
  assert.equal(
    evaluateAlertSeverity({ precipProb: 88, rainMm: 10.2, thunderProb: 65 }, DEFAULT_ALERT_RULES),
    'severe',
  );
  // Heavy rain mm/h triggers warning even if probability is below 70%
  assert.equal(
    evaluateAlertSeverity({ precipProb: 60, rainMm: 5.5, thunderProb: 20 }, DEFAULT_ALERT_RULES),
    'warning',
  );
  // High thunderstorm probability alone does not trigger orange alert when precipProb is low
  assert.equal(
    evaluateAlertSeverity({ precipProb: 35, rainMm: 0.5, thunderProb: 70 }, DEFAULT_ALERT_RULES),
    'none',
  );
  // High thunderstorm probability with watch-level precipProb escalates to warning
  assert.equal(
    evaluateAlertSeverity({ precipProb: 55, rainMm: 1.5, thunderProb: 70 }, DEFAULT_ALERT_RULES),
    'warning',
  );
});

test('extractAlertWindows groups contiguous risky hours and respects watchlistOnly filter', () => {
  const cells = buildFallbackGridForecast('2026-11-23T06:00:00.000Z');
  const allWindows = extractAlertWindows(cells, DEFAULT_ALERT_RULES, []);
  assert.ok(allWindows.length > 0, 'Expected at least one alert window in 48h SG forecast');

  for (const win of allWindows) {
    assert.ok(win.endHourIndex >= win.startHourIndex);
    assert.ok(win.peakHourIndex >= win.startHourIndex && win.peakHourIndex <= win.endHourIndex);
    assert.equal(win.durationHours, win.endHourIndex - win.startHourIndex + 1);
  }

  // Lowering thresholds increases or preserves alert coverage
  const strictRules = {
    ...DEFAULT_ALERT_RULES,
    watchThreshold: 30,
    warningThreshold: 45,
    severeThreshold: 60,
  };
  const strictSevereCount = extractAlertWindows(cells, strictRules, []).filter(
    (w) => w.severity === 'severe',
  ).length;
  const defaultSevereCount = allWindows.filter((w) => w.severity === 'severe').length;
  assert.ok(strictSevereCount >= defaultSevereCount);

  // Watchlist filtering restricts alert windows strictly to watched cells
  const watchlistWindows = extractAlertWindows(
    cells,
    { ...DEFAULT_ALERT_RULES, watchlistOnly: true },
    ['sg-marina-bay', 'sg-changi'],
  );
  assert.ok(
    watchlistWindows.every((w) => w.cellId === 'sg-marina-bay' || w.cellId === 'sg-changi'),
    'Watchlist-only mode leaked unmonitored cell',
  );
});

test('summarizeHourSnapshot and findPeakRiskHour return consistent island-wide telemetry', () => {
  const cells = buildFallbackGridForecast('2026-11-23T06:00:00.000Z');
  const peak = findPeakRiskHour(cells);
  assert.ok(peak.hourIndex >= 0 && peak.hourIndex < 48);
  assert.ok(peak.peakPrecipProb >= 70);

  const summary = summarizeHourSnapshot(cells, peak.hourIndex, DEFAULT_ALERT_RULES);
  assert.equal(summary.maxPrecipProb, peak.peakPrecipProb);
  assert.equal(summary.hourIndex, peak.hourIndex);
  assert.ok(summary.severeCount + summary.warningCount + summary.watchCount > 0);
});

test('formatSgtTimestamp formats Singapore UTC+8 timestamps cleanly', () => {
  const baseMs = Date.parse('2026-11-23T06:00:00.000Z'); // 14:00 SGT
  const t0 = formatSgtTimestamp(baseMs, 0);
  assert.equal(t0.shortHour, '14:00');
  assert.equal(t0.dayLabel, '今天');
  const t12 = formatSgtTimestamp(baseMs, 12); // 02:00 SGT next day
  assert.equal(t12.shortHour, '02:00');
  assert.equal(t12.dayLabel, '明天');
});
