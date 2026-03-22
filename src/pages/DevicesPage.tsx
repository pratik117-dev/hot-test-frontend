import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  Cpu, MapPin, Search, Wind,
  Flame, Gauge, Thermometer, Droplets, X, ChevronDown,
  Tag, Clock, Hash, Activity,
} from 'lucide-react';
import { dataApi } from '../services/api';
import { DeviceStatusBadge, DeviceTypeBadge } from '../components/ui/Badges';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { useWebSocket } from '../context/WebSocketContext';
import { format } from 'date-fns';
import clsx from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Reading {
  deviceId:     string;
  rawDeviceId?: string;
  device?:      { name?: string; location?: string; type?: string; status?: string; createdAt?: string };
  temperature:  number | null;
  humidity:     number | null;
  airQuality:   number | null;
  flame:        boolean | null;
  createdAt:    string;
}

type Status     = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
type DeviceType = 'AIR_QUALITY' | 'WEATHER' | 'NOISE' | 'WATER' | 'MULTI_SENSOR';

interface LiveDevice {
  id:        string;
  name:      string;
  location:  string;
  type:      DeviceType;
  status:    Status;
  firstSeen: string;  // ISO string of the first reading received
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VALID_STATUSES: Status[]     = ['ONLINE', 'OFFLINE', 'MAINTENANCE'];
const VALID_TYPES:    DeviceType[] = ['AIR_QUALITY', 'WEATHER', 'NOISE', 'WATER', 'MULTI_SENSOR'];
const STALE_MS = 10_000;

// Which sensors each device type exposes
const SENSORS_BY_TYPE: Record<DeviceType, string[]> = {
  AIR_QUALITY:  ['Temperature', 'Humidity', 'Air Quality', 'Flame'],
  WEATHER:      ['Temperature', 'Humidity'],
  NOISE:        ['Noise Level'],
  WATER:        ['Water Quality', 'Temperature'],
  MULTI_SENSOR: ['Temperature', 'Humidity', 'Air Quality', 'Flame'],
};

// Human-readable label for each type
const TYPE_LABEL: Record<DeviceType, string> = {
  AIR_QUALITY:  'Air Quality Monitor',
  WEATHER:      'Weather Station',
  NOISE:        'Noise Monitor',
  WATER:        'Water Sensor',
  MULTI_SENSOR: 'Multi Sensor',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDevice(r: Reading, firstSeen: string): LiveDevice {
  const rawStatus = r.device?.status ?? 'ONLINE';
  const rawType   = r.device?.type   ?? 'MULTI_SENSOR';
  return {
    id:        r.deviceId,
    name:      r.device?.name     || r.rawDeviceId || r.deviceId,
    location:  r.device?.location || 'Unknown',
    type:      VALID_TYPES.includes(rawType as DeviceType)    ? (rawType as DeviceType)  : 'MULTI_SENSOR',
    status:    VALID_STATUSES.includes(rawStatus as Status)   ? (rawStatus as Status)    : 'ONLINE',
    firstSeen,
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

// ── Stable device info card ───────────────────────────────────────────────────
// Memoized — only re-renders when device metadata or selection state changes.
// Does NOT receive live readings — card content is purely device info.
const DeviceInfoCard = memo(function DeviceInfoCard({
  device,
  lastSeen,
  hasFlame,
  isActive,
  onClick,
}: {
  device:   LiveDevice;
  lastSeen: string | null;  // ISO timestamp of latest reading
  hasFlame: boolean;
  isActive: boolean;
  onClick:  () => void;
}) {
  const sensors = SENSORS_BY_TYPE[device.type] ?? [];

  return (
    <button
      onClick={onClick}
      className={clsx(
        'card p-5 text-left transition-all hover:shadow-md w-full',
        isActive  && 'ring-2 ring-brand-400 bg-brand-50/30 dark:bg-brand-500/5',
        hasFlame  && !isActive && 'border-red-200 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5',
      )}
    >
      {/* Top row — icon + chevron */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-brand-500" />
        </div>
        <ChevronDown className={clsx(
          'w-4 h-4 text-slate-400 transition-transform mt-1',
          isActive && 'rotate-180 text-brand-500',
        )} />
      </div>

      {/* Name */}
      <h3 className="font-semibold text-slate-900 dark:text-white mb-0.5 truncate flex items-center gap-1.5">
        {device.name}
        {hasFlame && <span title="Flame detected">🔥</span>}
      </h3>

      {/* Device type label */}
      <p className="text-xs text-brand-500 dark:text-brand-400 font-medium mb-3">
        {TYPE_LABEL[device.type]}
      </p>

      {/* Info rows */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="truncate">{device.location}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Hash className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="font-mono truncate">{device.id}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Clock className="w-3 h-3 shrink-0 text-slate-400" />
          <span>
            Last seen: {lastSeen ? format(new Date(lastSeen), 'HH:mm:ss') : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Tag className="w-3 h-3 shrink-0 text-slate-400" />
          <span>Since {format(new Date(device.firstSeen), 'MMM d, HH:mm')}</span>
        </div>
      </div>

      {/* Sensors used */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">Sensors</p>
        <div className="flex flex-wrap gap-1">
          {sensors.map(s => (
            <span
              key={s}
              className="px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap mt-3">
        <DeviceStatusBadge status={device.status} />
        <DeviceTypeBadge   type={device.type} />
      </div>
    </button>
  );
});

// ── Sensor spec definitions ───────────────────────────────────────────────────
const SENSOR_SPECS: Record<string, {
  icon: string; unit: string; range: string; description: string; color: string;
}> = {
  'Temperature': {
    icon: '🌡️', unit: '°C', range: '-40 to 85°C',
    description: 'Measures ambient air temperature using a thermistor element.',
    color: 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30',
  },
  'Humidity': {
    icon: '💧', unit: '%RH', range: '0 – 100 %RH',
    description: 'Capacitive sensor measuring relative moisture in the air.',
    color: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
  },
  'Air Quality': {
    icon: '🌬️', unit: 'AQI', range: '0 – 500 AQI',
    description: 'Metal-oxide sensor detecting VOCs, smoke and particulate matter.',
    color: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30',
  },
  'Flame': {
    icon: '🔥', unit: 'boolean', range: 'Detected / Clear',
    description: 'IR photodiode detecting 760–1100 nm wavelength flame emission.',
    color: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
  },
  'Noise Level': {
    icon: '🔊', unit: 'dB', range: '30 – 130 dB',
    description: 'MEMS microphone measuring sound pressure level in decibels.',
    color: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30',
  },
  'Water Quality': {
    icon: '🧪', unit: 'TDS/pH', range: '0 – 1000 TDS',
    description: 'Conductivity probe measuring dissolved solids and water purity.',
    color: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30',
  },
};

// ── Device detail panel — device info & sensor specs ─────────────────────────
function DeviceDetailPanel({
  device,
  allReadings,
  onClose,
}: {
  device:      LiveDevice;
  allReadings: Reading[];
  onClose:     () => void;
}) {
  const latest   = allReadings.find(r => r.deviceId === device.id) ?? null;
  const hasFlame = allReadings.some(r => r.deviceId === device.id && r.flame === true);
  const sensors  = SENSORS_BY_TYPE[device.type] ?? [];

  return (
    <div className={clsx(
      'rounded-2xl border-2 transition-colors',
      hasFlame
        ? 'border-red-400 dark:border-red-500/60 bg-red-50/40 dark:bg-red-500/5'
        : 'border-brand-200 dark:border-brand-500/30 bg-brand-50/30 dark:bg-brand-500/5',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-brand-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {device.name} {hasFlame && '🔥'}
            </h2>
            <p className="text-xs text-brand-500 dark:text-brand-400 font-medium">
              {TYPE_LABEL[device.type]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DeviceStatusBadge status={device.status} />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Device identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: <Hash className="w-3.5 h-3.5" />,      label: 'Device ID',    value: device.id,       mono: true },
            { icon: <MapPin className="w-3.5 h-3.5" />,    label: 'Location',     value: device.location, mono: false },
            { icon: <Tag className="w-3.5 h-3.5" />,       label: 'Device Type',  value: device.type.replace(/_/g, ' '), mono: false },
            { icon: <Clock className="w-3.5 h-3.5" />,     label: 'Online Since', value: format(new Date(device.firstSeen), 'MMM d, yyyy · HH:mm'), mono: false },
            { icon: <Activity className="w-3.5 h-3.5" />,  label: 'Last Reading', value: latest ? format(new Date(latest.createdAt), 'HH:mm:ss') : '—', mono: false },
            { icon: <Cpu className="w-3.5 h-3.5" />,       label: 'Sensor Count', value: `${sensors.length} sensor${sensors.length !== 1 ? 's' : ''}`, mono: false },
          ].map(row => (
            <div key={row.label} className="flex items-start gap-2.5 bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
              <span className="text-slate-400 mt-0.5 shrink-0">{row.icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 dark:text-slate-500">{row.label}</p>
                <p className={clsx(
                  'text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5',
                  row.mono && 'font-mono',
                )}>
                  {row.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Sensor specs */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Installed Sensors
          </h3>
          <div className="space-y-2">
            {sensors.map(sensor => {
              const spec = SENSOR_SPECS[sensor];
              if (!spec) return null;

              // Pull current live value for this sensor
              let currentValue: string = '—';
              if (latest) {
                if (sensor === 'Temperature' && latest.temperature != null)
                  currentValue = `${Number(latest.temperature).toFixed(1)} ${spec.unit}`;
                else if (sensor === 'Humidity' && latest.humidity != null)
                  currentValue = `${Number(latest.humidity).toFixed(0)} ${spec.unit}`;
                else if (sensor === 'Air Quality' && latest.airQuality != null)
                  currentValue = `${Number(latest.airQuality).toFixed(0)} ${spec.unit}`;                else if (sensor === 'Flame' && latest.flame != null)
                  currentValue = latest.flame ? '🔥 Detected' : '✅ Clear';
              }

              return (
                <div
                  key={sensor}
                  className={clsx(
                    'flex items-start gap-3 rounded-xl border p-3',
                    spec.color,
                  )}
                >
                  <span className="text-xl shrink-0 mt-0.5">{spec.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{sensor}</p>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        {currentValue}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {spec.description}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      Range: {spec.range} · Unit: {spec.unit}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const { lastSensorData } = useWebSocket();

  const [timeSeriesData, setTimeSeriesData] = useState<Reading[]>([]);
  const [recentReadings, setRecentReadings] = useState<Reading[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // ── Stable device registries ──────────────────────────────────────────────
  const deviceOrderRef = useRef<string[]>([]);
  const lastSeenRef    = useRef<Record<string, number>>({});
  const latestReadRef  = useRef<Record<string, string>>({});  // deviceId → lastSeen ISO

  const [deviceOrder, setDeviceOrder] = useState<string[]>([]);
  const [liveDevMap,  setLiveDevMap]  = useState<Record<string, LiveDevice>>({});
  // latestRead: deviceId → ISO timestamp, drives "Last seen" on the card without
  // passing the whole Reading object (keeps the memo boundary tight)
  const [latestRead,  setLatestRead]  = useState<Record<string, string>>({});
  // flameSet: set of deviceIds currently reporting flame
  const [flameSet,    setFlameSet]    = useState<Set<string>>(new Set());

  // ── Derived ───────────────────────────────────────────────────────────────
  const liveDevices = useMemo(
    () => deviceOrder.map(id => liveDevMap[id]).filter(Boolean) as LiveDevice[],
    [deviceOrder, liveDevMap],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return liveDevices;
    return liveDevices.filter(d =>
      d.name.toLowerCase().includes(q)     ||
      d.location.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q)
    );
  }, [liveDevices, search]);

  const selectedDevice = useMemo(
    () => liveDevMap[selectedDeviceId ?? ''] ?? null,
    [liveDevMap, selectedDeviceId],
  );

  // ── Register a live reading ───────────────────────────────────────────────
  const registerReading = useCallback((r: Reading) => {
    const now = Date.now();
    lastSeenRef.current[r.deviceId] = now;

    // Update last-seen timestamp
    latestReadRef.current[r.deviceId] = r.createdAt;
    setLatestRead(prev =>
      prev[r.deviceId] === r.createdAt ? prev : { ...prev, [r.deviceId]: r.createdAt }
    );

    // Update flame set
    setFlameSet(prev => {
      const next = new Set(prev);
      r.flame ? next.add(r.deviceId) : next.delete(r.deviceId);
      return next;
    });

    // Register device metadata once — stable, doesn't update on every reading
    setLiveDevMap(prev => {
      if (prev[r.deviceId]) return prev;
      return { ...prev, [r.deviceId]: toDevice(r, r.createdAt) };
    });

    // Append to order only if new
    if (!deviceOrderRef.current.includes(r.deviceId)) {
      deviceOrderRef.current = [...deviceOrderRef.current, r.deviceId];
      setDeviceOrder([...deviceOrderRef.current]);
    }
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [tsRes, latestRes] = await Promise.all([
        dataApi.getTimeSeries({ hours: 6 }),
        dataApi.getAll({ limit: 50 }),
      ]);
      // Historical readings populate charts and detail panel only —
      // they do NOT register devices (only live WS pushes do that)
      setTimeSeriesData(tsRes.data.data || []);
      setRecentReadings(latestRes.data.data || []);
    } catch (err) {
      console.error('DevicesPage fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live WebSocket — register + append
  useEffect(() => {
    if (!lastSensorData) return;
    const r = lastSensorData as Reading;
    registerReading(r);
    setTimeSeriesData(prev => [...prev.slice(-800), r]);
    setRecentReadings(prev => [r, ...prev].slice(0, 50));
  }, [lastSensorData, registerReading]);

  // Pruning — evict devices silent for >STALE_MS
  useEffect(() => {
    const id = setInterval(() => {
      const now   = Date.now();
      const stale = Object.keys(lastSeenRef.current).filter(
        devId => now - lastSeenRef.current[devId] > STALE_MS,
      );
      if (!stale.length) return;
      stale.forEach(devId => {
        delete lastSeenRef.current[devId];
        delete latestReadRef.current[devId];
      });
      const alive = new Set(Object.keys(lastSeenRef.current));
      deviceOrderRef.current = deviceOrderRef.current.filter(id => alive.has(id));
      setDeviceOrder([...deviceOrderRef.current]);
      setLiveDevMap(prev  => Object.fromEntries(Object.entries(prev).filter(([id]) => alive.has(id))));
      setLatestRead(prev  => Object.fromEntries(Object.entries(prev).filter(([id]) => alive.has(id))));
      setFlameSet(prev    => new Set([...prev].filter(id => alive.has(id))));
      setRecentReadings(prev => prev.filter(r => alive.has(r.deviceId)));
      setTimeSeriesData(prev => prev.filter(r => alive.has(r.deviceId)));
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  // Auto-deselect if pruned
  useEffect(() => {
    if (selectedDeviceId && !lastSeenRef.current[selectedDeviceId]) {
      setSelectedDeviceId(null);
    }
  }, [selectedDeviceId, deviceOrder]);

  const handleCardClick = (deviceId: string) =>
    setSelectedDeviceId(prev => prev === deviceId ? null : deviceId);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader message="Loading devices..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Devices</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {liveDevices.length} device{liveDevices.length !== 1 ? 's' : ''} reporting
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, location or type..."
          className="input pl-9"
        />
      </div>

      {/* Device grid — stable, cards never reorder */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No devices found"
          description={
            liveDevices.length === 0
              ? 'Waiting for data from the simulator...'
              : 'No devices match your search'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(device => (
            <DeviceInfoCard
              key={device.id}
              device={device}
              lastSeen={latestRead[device.id] ?? null}
              hasFlame={flameSet.has(device.id)}
              isActive={selectedDeviceId === device.id}
              onClick={() => handleCardClick(device.id)}
            />
          ))}
        </div>
      )}

      {/* Inline detail panel */}
      {selectedDevice && (
        <DeviceDetailPanel
          device={selectedDevice}
          allReadings={recentReadings}
          onClose={() => setSelectedDeviceId(null)}
        />
      )}
    </div>
  );
}