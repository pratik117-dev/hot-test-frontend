import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  Wind, Flame, Gauge,
  ChevronDown, X, LayoutDashboard, Check,
  Thermometer, Droplets,
} from 'lucide-react';
import { dataApi } from '../services/api';
import StatCard from '../components/ui/StatCard';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';
import { PageLoader } from '../components/ui/Spinner';
import { useWebSocket } from '../context/WebSocketContext';
import { format } from 'date-fns';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Reading {
  deviceId:     string;
  rawDeviceId?: string;
  device?:      { name?: string; location?: string };
  temperature:  number | null;
  humidity:     number | null;
  airQuality:   number | null;
  flame:        boolean | null;
  createdAt:    string;
}

interface LiveDevice {
  id:       string;
  name:     string;
  location: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDevice(r: Reading): LiveDevice {
  return {
    id:       r.deviceId,
    name:     r.device?.name     || r.rawDeviceId || r.deviceId,
    location: r.device?.location || 'Unknown',
  };
}

function getAQLabel(val: number | null): string {
  if (val === null) return '—';
  if (val <= 50)  return 'Good';
  if (val <= 100) return 'Moderate';
  if (val <= 150) return 'Unhealthy (Sensitive)';
  if (val <= 200) return 'Unhealthy';
  if (val <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function getAQColor(val: number | null): string {
  if (val === null) return 'text-slate-500';
  if (val <= 50)  return 'text-emerald-500';
  if (val <= 100) return 'text-yellow-500';
  if (val <= 150) return 'text-orange-500';
  if (val <= 200) return 'text-red-500';
  return 'text-purple-500';
}

function calcAvg(arr: (number | null | undefined)[]): number | null {
  const nums = arr.filter((n): n is number => n !== null && n !== undefined);
  if (!nums.length) return null;
  return parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1));
}

// Simulator publishes every 2 s — treat silence > 30 s as device removed.
// 30 s gives 15 missed publishes of headroom for network jitter.
const STALE_MS = 30_000;

// ── Device selector dropdown ──────────────────────────────────────────────────
function DeviceSelector({
  devices,
  selectedId,
  onSelect,
}: {
  devices:    LiveDevice[];
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  if (!devices.length) return null;

  const selected = devices.find(d => d.id === selectedId) ?? null;

  return (
    <div className="relative w-fit" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
          open || selected
            ? 'bg-brand-500 text-white border-transparent shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500',
        )}
      >
        <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
        {selected ? selected.name : 'All Devices'}
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[200px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
              !selectedId
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60',
            )}
          >
            <span className="w-4 flex justify-center">
              {!selectedId && <Check className="w-3 h-3" />}
            </span>
            All devices
          </button>

          <div className="border-t border-slate-100 dark:border-slate-700" />

          {devices.map(d => {
            const isSelected = selectedId === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { onSelect(isSelected ? null : d.id); setOpen(false); }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60',
                )}
              >
                <span className="w-4 flex justify-center">
                  {isSelected
                    ? <Check className="w-3 h-3" />
                    : <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  }
                </span>
                <span className="truncate">{d.name}</span>
                <span className="ml-auto text-slate-400 dark:text-slate-500 shrink-0">{d.location}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Flame banner ──────────────────────────────────────────────────────────────
function FlameBanner({ readings }: { readings: Reading[] }) {
  if (!readings.length) return null;
  const latest = readings[readings.length - 1];
  return (
    <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-500/10 p-4 flex items-start gap-3 animate-pulse-slow">
      <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
        <Flame className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-red-700 dark:text-red-400 text-sm">🔥 FLAME DETECTED</p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
          Device: <strong>{latest.device?.name || latest.rawDeviceId || latest.deviceId}</strong>
          {' · '}Location: {latest.device?.location || 'Unknown'}
          {' · '}{format(new Date(latest.createdAt), 'HH:mm:ss')}
        </p>
        <p className="text-xs text-red-500 mt-1">
          {readings.length} flame reading{readings.length > 1 ? 's' : ''} in current batch.
          Check the Alerts page for full history.
        </p>
      </div>
    </div>
  );
}

// ── Duration options ──────────────────────────────────────────────────────────
const DURATIONS = [
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '1 hr',   minutes: 60 },
  { label: '6 hr',   minutes: 360 },
  { label: '12 hr',  minutes: 720 },
  { label: '24 hr',  minutes: 1440 },
] as const;

type DurationMinutes = typeof DURATIONS[number]['minutes'];

// ── Per-device detail panel ───────────────────────────────────────────────────
// INITIAL_HOURS must match the hours passed to dataApi.getTimeSeries on load.
const INITIAL_HOURS = 6;

function DeviceDetailPanel({
  device,
  allReadings,
  cachedTimeSeries,
  onClose,
}: {
  device:           LiveDevice;
  allReadings:      Reading[];
  cachedTimeSeries: Reading[];  // already-fetched 6-hr data from parent
  onClose:          () => void;
}) {
  const [durationMin,  setDurationMin]  = useState<DurationMinutes>(60);
  const [extraData,    setExtraData]    = useState<Reading[]>([]);
  const [fetching,     setFetching]     = useState(false);

  const readings = allReadings.filter(r => r.deviceId === device.id);
  const latest   = readings[0] ?? null;

  const hasFlame   = readings.some(r => r.flame === true);
  const flameCount = readings.filter(r => r.flame === true).length;

  const avgTemp = calcAvg(readings.map(r => r.temperature));
  const avgHum  = calcAvg(readings.map(r => r.humidity));
  const avgAQ   = calcAvg(readings.map(r => r.airQuality));

  const selectedDuration = DURATIONS.find(d => d.minutes === durationMin)!;
  const cutoff = useMemo(
    () => Date.now() - durationMin * 60 * 1000,
    [durationMin],
  );

  // For windows ≤ INITIAL_HOURS: use the already-loaded cachedTimeSeries.
  // For longer windows (12hr, 24hr): fetch additional data from the API.
  useEffect(() => {
    const neededHours = durationMin / 60;
    if (neededHours <= INITIAL_HOURS) {
      setExtraData([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setFetching(true);
      try {
        const res = await dataApi.getTimeSeries({ hours: neededHours });
        if (!cancelled) {
          const raw: Reading[] = res.data.data || [];
          setExtraData(raw.filter(r => r.deviceId === device.id));
        }
      } catch {
        if (!cancelled) setExtraData([]);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [device.id, durationMin]);

  // Merge cached + extra, deduplicate, filter to device + time window.
  // Live WS readings in allReadings are prepended so charts stay current.
  const chartData = useMemo(() => {
    const base = extraData.length > 0 ? extraData : cachedTimeSeries;
    const liveForDevice = allReadings.filter(r => r.deviceId === device.id);
    const merged = [...liveForDevice, ...base];
    const seen   = new Set<string>();
    return merged
      .filter(r => {
        if (r.deviceId !== device.id) return false;
        if (new Date(r.createdAt).getTime() < cutoff) return false;
        if (seen.has(r.createdAt)) return false;
        seen.add(r.createdAt);
        return true;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [cachedTimeSeries, extraData, allReadings, device.id, cutoff]);

  // Table rows: same window, newest first
  const windowReadings = useMemo(
    () => readings.filter(r => new Date(r.createdAt).getTime() >= cutoff),
    [readings, cutoff],
  );

  return (
    <div className={clsx(
      'rounded-2xl border-2 transition-colors',
      hasFlame
        ? 'border-red-400 dark:border-red-500/60 bg-red-50/40 dark:bg-red-500/5'
        : 'border-brand-200 dark:border-brand-500/30 bg-brand-50/30 dark:bg-brand-500/5',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {device.name} {hasFlame && '🔥'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {device.location} · ID: {device.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Duration picker */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {DURATIONS.map(d => (
              <button
                key={d.minutes}
                onClick={() => setDurationMin(d.minutes)}
                className={clsx(
                  'px-2 py-1 rounded-md text-xs font-medium transition-all',
                  durationMin === d.minutes
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Temperature"
            value={avgTemp ?? '--'}
            unit="°C"
            icon={Thermometer}
            color="red"
            subtitle={latest?.temperature != null ? `Last: ${Number(latest.temperature).toFixed(1)}°C` : 'No data'}
          />
          <StatCard
            title="Humidity"
            value={avgHum ?? '--'}
            unit="%"
            icon={Droplets}
            color="blue"
            subtitle={latest?.humidity != null ? `Last: ${Number(latest.humidity).toFixed(0)}%` : 'No data'}
          />
          <StatCard
            title="Air Quality"
            value={avgAQ ?? '--'}
            icon={Gauge}
            color="purple"
            subtitle={getAQLabel(avgAQ)}
          />
          <StatCard
            title="Flame Status"
            value={hasFlame ? '🔥 Alert' : '✅ Clear'}
            icon={Flame}
            color={hasFlame ? 'red' : 'green'}
            subtitle={hasFlame ? `${flameCount} reading${flameCount > 1 ? 's' : ''} flagged` : 'No flame detected'}
          />
        </div>

        {/* Recent readings table — filtered to duration window */}
        <div className="card p-4 overflow-auto">
          <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
            Readings · Last {selectedDuration.label}
          </h4>
          {windowReadings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              No readings in the last {selectedDuration.label}.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left pb-2 font-medium">Time</th>
                  <th className="text-right pb-2 font-medium">Temp</th>
                  <th className="text-right pb-2 font-medium">Hum</th>
                  <th className="text-right pb-2 font-medium">AQ</th>
                  <th className="text-right pb-2 font-medium">Flame</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {windowReadings.slice(0, 15).map((r, i) => (
                  <tr key={i} className={clsx('transition-colors', r.flame ? 'bg-red-50/50 dark:bg-red-500/5' : '')}>
                    <td className="py-1.5 text-slate-500">{format(new Date(r.createdAt), 'HH:mm:ss')}</td>
                    <td className="py-1.5 text-right text-orange-500 font-medium">
                      {r.temperature != null ? `${Number(r.temperature).toFixed(1)}°` : '—'}
                    </td>
                    <td className="py-1.5 text-right text-blue-500 font-medium">
                      {r.humidity != null ? `${Number(r.humidity).toFixed(0)}%` : '—'}
                    </td>
                    <td className={clsx('py-1.5 text-right font-medium', getAQColor(r.airQuality))}>
                      {r.airQuality != null ? Number(r.airQuality).toFixed(0) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.flame ? '🔥' : <span className="text-emerald-500">✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Per-device time series — fetched fresh from DB for selected window */}
        {fetching ? (
          <div className="card p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
            Loading {selectedDuration.label} of data…
          </div>
        ) : chartData.length > 1 ? (() => {
          return (
            <>
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Thermometer className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Temperature · Last {selectedDuration.label}
                  </h3>
                </div>
                <TimeSeriesChart
                  data={chartData}
                  metrics={[{ key: 'temperature', label: 'Temp (°C)', color: '#f97316', threshold: 75 }]}
                  height={180}
                />
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Humidity · Last {selectedDuration.label}
                  </h3>
                </div>
                <TimeSeriesChart
                  data={chartData}
                  metrics={[{ key: 'humidity', label: 'Humidity (%)', color: '#3b82f6', threshold: 80 }]}
                  height={180}
                />
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Wind className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Air Quality · Last {selectedDuration.label}
                  </h3>
                </div>
                <TimeSeriesChart
                  data={chartData}
                  metrics={[{ key: 'airQuality', label: 'Air Quality', color: '#8b5cf6', threshold: 150 }]}
                  height={180}
                />
              </div>

            </>
          );
        })() : (
          <div className="card p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
            Not enough data in the last {selectedDuration.label} to plot charts.
            Try a wider time range.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stable device summary card (memoized — only re-renders when its reading changes) ──
const DeviceSummaryCard = memo(function DeviceSummaryCard({ r }: { r: Reading }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
            {r.device?.name || r.rawDeviceId || r.deviceId}
          </h4>
          <p className="text-xs text-slate-400">
            {r.device?.location || 'Unknown'} · {r.deviceId}
          </p>
        </div>
        <span className="text-xs text-slate-400">
          {format(new Date(r.createdAt), 'HH:mm:ss')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { label: 'Temp',        value: r.temperature, unit: '°C', color: 'text-orange-500' },
          { label: 'Humidity',    value: r.humidity,    unit: '%',  color: 'text-blue-500' },
          { label: 'Air Quality', value: r.airQuality,  unit: '',   color: getAQColor(r.airQuality) },
          {
            label: 'Flame',
            value: r.flame != null ? (r.flame ? '🔥 YES' : '✅ No') : null,
            unit:  '',
            color: r.flame ? 'text-red-500' : 'text-emerald-500',
          },
        ] as const).filter(f => f.value !== null && f.value !== undefined).map(f => (
          <div key={f.label} className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{f.label}</p>
            <p className={clsx('font-bold text-sm', f.color)}>
              {typeof f.value === 'number' ? Number(f.value).toFixed(1) : f.value}
              {typeof f.value === 'number' && (
                <span className="text-xs font-normal text-slate-400 ml-0.5">{f.unit}</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { lastSensorData, lastAlert, connected } = useWebSocket();

  const [timeSeriesData, setTimeSeriesData] = useState<Reading[]>([]);
  const [loading, setLoading]               = useState(true);
  const [lastUpdated, setLastUpdated]       = useState<Date>(new Date());
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // ── Stable device registry ────────────────────────────────────────────────
  // deviceOrder: insertion-order list of deviceIds — NEVER reorders, cards stay put
  // latestMap:   Record<deviceId, Reading> — only the changed device's entry updates
  // liveDevices: Record<deviceId, LiveDevice> — device metadata, stable once set
  const deviceOrderRef  = useRef<string[]>([]);
  const lastSeenRef     = useRef<Record<string, number>>({});

  const [latestMap,    setLatestMap]    = useState<Record<string, Reading>>({});
  const [liveDevMap,   setLiveDevMap]   = useState<Record<string, LiveDevice>>({});
  const [deviceOrder,  setDeviceOrder]  = useState<string[]>([]);

  // recentReadings kept only for DeviceDetailPanel and time-series filtering
  const [recentReadings, setRecentReadings] = useState<Reading[]>([]);

  // ── Stable derived values ──────────────────────────────────────────────────
  const liveDevices = useMemo(
    () => deviceOrder.map(id => liveDevMap[id]).filter(Boolean) as LiveDevice[],
    [deviceOrder, liveDevMap],
  );

  const activeFlames = useMemo(
    () => Object.values(latestMap).filter(r => r.flame === true),
    [latestMap],
  );

  const selectedDevice = useMemo(
    () => liveDevMap[selectedDeviceId ?? ''] ?? null,
    [liveDevMap, selectedDeviceId],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Register a new reading: updates latestMap in-place, adds device to order only once
  const registerReading = useCallback((r: Reading) => {
    lastSeenRef.current[r.deviceId] = Date.now();

    // Update latest reading for this device only
    setLatestMap(prev =>
      prev[r.deviceId]?.createdAt === r.createdAt ? prev : { ...prev, [r.deviceId]: r }
    );

    // Register device metadata once (stable — doesn't change on every reading)
    setLiveDevMap(prev => {
      if (prev[r.deviceId]) return prev;
      return { ...prev, [r.deviceId]: toDevice(r) };
    });

    // Append to insertion-order list only if new
    if (!deviceOrderRef.current.includes(r.deviceId)) {
      deviceOrderRef.current = [...deviceOrderRef.current, r.deviceId];
      setDeviceOrder([...deviceOrderRef.current]);
    }
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [tsRes, latestRes] = await Promise.all([
        dataApi.getTimeSeries({ hours: 6 }),
        dataApi.getAll({ limit: 50 }),
      ]);
      const readings: Reading[] = latestRes.data.data || [];
      // Historical readings populate time-series and detail panel only.
      // They do NOT register devices — only live WS pushes do that.
      setTimeSeriesData(tsRes.data.data || []);
      setRecentReadings(readings);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live WebSocket — register reading, update time series + recent readings
  useEffect(() => {
    if (!lastSensorData) return;
    const r = lastSensorData as Reading;
    registerReading(r);
    setTimeSeriesData(prev => [...prev.slice(-800), r]);
    setRecentReadings(prev => [r, ...prev].slice(0, 50));
    setLastUpdated(new Date());
  }, [lastSensorData, registerReading]);

  // Alert → full refresh
  useEffect(() => {
    if (lastAlert) fetchData();
  }, [lastAlert, fetchData]);

  // Pruning — evict devices silent for >STALE_MS
  useEffect(() => {
    const id = setInterval(() => {
      const now   = Date.now();
      const stale = Object.keys(lastSeenRef.current).filter(
        devId => now - lastSeenRef.current[devId] > STALE_MS,
      );
      if (!stale.length) return;

      stale.forEach(devId => delete lastSeenRef.current[devId]);
      const alive = new Set(Object.keys(lastSeenRef.current));

      // Remove from all stable registries
      deviceOrderRef.current = deviceOrderRef.current.filter(id => alive.has(id));
      setDeviceOrder([...deviceOrderRef.current]);
      setLatestMap(prev  => Object.fromEntries(Object.entries(prev).filter(([id]) => alive.has(id))));
      setLiveDevMap(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => alive.has(id))));
      setRecentReadings(prev => prev.filter(r => alive.has(r.deviceId)));
      setTimeSeriesData(prev => prev.filter(r => alive.has(r.deviceId)));
      // Never auto-deselect — the user controls the panel via the close button.
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader message="Loading dashboard..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Updated {format(lastUpdated, 'HH:mm:ss')}
            {connected && <span className="ml-2 text-brand-500">● Live</span>}
          </p>
        </div>

        <DeviceSelector
          devices={liveDevices}
          selectedId={selectedDeviceId}
          onSelect={setSelectedDeviceId}
        />
      </div>

      {/* Per-device detail panel */}
      {selectedDevice && (
        <DeviceDetailPanel
          device={selectedDevice}
          allReadings={recentReadings}
          cachedTimeSeries={timeSeriesData}
          onClose={() => setSelectedDeviceId(null)}
        />
      )}

      {/* Global flame banner */}
      <FlameBanner readings={activeFlames} />

      {/* Per-device summary cards — stable grid, only data values update */}
      {deviceOrder.length === 0 ? (
        <div className="card p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          Waiting for data from the simulator…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {deviceOrder.map(deviceId => {
            const r = latestMap[deviceId];
            if (!r) return null;
            return <DeviceSummaryCard key={deviceId} r={r} />;
          })}
        </div>
      )}
    </div>
  );
}