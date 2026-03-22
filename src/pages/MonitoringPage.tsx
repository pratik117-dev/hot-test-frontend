import { useEffect, useState, useCallback } from 'react';
import { Activity, Radio, RefreshCw, Flame } from 'lucide-react';
import { dataApi, devicesApi } from '../services/api';
import TimeSeriesChart from '../components/charts/TimeSeriesChart';
import { PageLoader } from '../components/ui/Spinner';
import { useWebSocket } from '../context/WebSocketContext';
import { format } from 'date-fns';
import clsx from 'clsx';

// ── Chart groups matching your Arduino payload ────────────────────────────────
const METRIC_GROUPS = [
  {
    label: 'Climate',
    metrics: [
      { key: 'temperature', label: 'Temperature (°C)', color: '#f97316', threshold: 75 },
      { key: 'humidity',    label: 'Humidity (%)',     color: '#3b82f6', threshold: 80 },
    ],
  },
  {
    label: 'Air Quality',
    metrics: [
      { key: 'airQuality', label: 'Air Quality Index', color: '#8b5cf6', threshold: 150 },
      { key: 'co2',        label: 'CO₂ (ppm)',         color: '#06b6d4', threshold: 1000 },
      { key: 'pm25',       label: 'PM2.5 (µg/m³)',     color: '#14b8a6', threshold: 35 },
    ],
  },
  {
    label: 'Other Sensors',
    metrics: [
      { key: 'noise',     label: 'Noise (dB)',       color: '#f43f5e', threshold: 70 },
      { key: 'ph',        label: 'pH',               color: '#22c55e' },
      { key: 'turbidity', label: 'Turbidity (NTU)',  color: '#a855f7', threshold: 4 },
    ],
  },
];

const HOUR_OPTIONS = [
  { label: '1 hour',  value: '1'  },
  { label: '6 hours', value: '6'  },
  { label: '12 hours', value: '12' },
  { label: '24 hours', value: '24' },
  { label: '48 hours', value: '48' },
];

export default function MonitoringPage() {
  const { lastSensorData, connected } = useWebSocket();
  const [data, setData]         = useState<any[]>([]);
  const [devices, setDevices]   = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [hours, setHours]       = useState('24');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await dataApi.getTimeSeries({ deviceId: deviceId || undefined, hours });
      setData(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [deviceId, hours]);

  useEffect(() => {
    devicesApi.getAll().then(r => setDevices(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Append live data
  useEffect(() => {
    if (!lastSensorData) return;
    if (deviceId && lastSensorData.deviceId !== deviceId) return;
    setData(prev => [...prev.slice(-1000), lastSensorData]);
  }, [lastSensorData, deviceId]);

  // Latest reading for "current values" row
  const latest = data.length > 0 ? data[data.length - 1] : null;

  // How many flame readings in current view
  const flameCount = data.filter(d => d.flame === true).length;

  if (loading) return <PageLoader message="Loading sensor data..." />;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Data Monitoring</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.length.toLocaleString()} readings
            {connected && <span className="ml-2 text-brand-500 inline-flex items-center gap-1"><Radio className="w-3 h-3 inline" /> Live</span>}
            {flameCount > 0 && (
              <span className="ml-3 text-red-500 font-medium">🔥 {flameCount} flame reading{flameCount > 1 ? 's' : ''} in range</span>
            )}
          </p>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="btn-secondary self-start sm:self-auto flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="label">Device / Node</label>
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="input">
            <option value="">All Nodes</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.location}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <label className="label">Time Range</label>
          <select value={hours} onChange={e => setHours(e.target.value)} className="input">
            {HOUR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Latest reading values */}
      {latest && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Latest Reading
              {latest.device?.name && <span className="ml-1 text-slate-400 font-normal">— {latest.device.name}</span>}
            </h3>
            <span className="text-xs text-slate-400 ml-auto">{format(new Date(latest.createdAt), 'HH:mm:ss')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Temperature', value: latest.temperature, unit: '°C',   color: 'text-orange-500' },
              { label: 'Humidity',    value: latest.humidity,    unit: '%',    color: 'text-blue-500'   },
              { label: 'Air Quality', value: latest.airQuality,  unit: '',     color: 'text-purple-500' },
              { label: 'CO₂',        value: latest.co2,         unit: 'ppm',  color: 'text-cyan-500'   },
              { label: 'Noise',      value: latest.noise,       unit: 'dB',   color: 'text-rose-500'   },
              { label: 'Flame',
                value: latest.flame !== null && latest.flame !== undefined
                  ? (latest.flame ? '🔥 YES' : '✅ No') : null,
                unit: '',
                color: latest.flame ? 'text-red-500 font-bold' : 'text-emerald-500',
              },
            ].filter(f => f.value !== null && f.value !== undefined).map(f => (
              <div key={f.label} className={clsx(
                'rounded-xl p-3 text-center',
                f.label === 'Flame' && latest.flame
                  ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'
                  : 'bg-slate-50 dark:bg-slate-700/40'
              )}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{f.label}</p>
                <p className={clsx('font-bold text-sm mt-0.5', f.color)}>
                  {typeof f.value === 'number' ? Number(f.value).toFixed(1) : f.value}
                  {typeof f.value === 'number' && f.unit && (
                    <span className="text-xs font-normal text-slate-400 ml-0.5">{f.unit}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flame event timeline (if any in range) */}
      {flameCount > 0 && (
        <div className="card p-4 border border-red-200 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
              Flame Detection Events in Selected Range
            </h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {data.filter(d => d.flame === true).slice(-20).reverse().map(d => (
              <div key={d.id} className="flex items-center gap-3 text-xs text-red-600 dark:text-red-400">
                <span className="font-mono">{format(new Date(d.createdAt), 'HH:mm:ss')}</span>
                <span>🔥</span>
                <span>{d.device?.name || d.rawDeviceId || d.deviceId}</span>
                {d.temperature && <span>· {Number(d.temperature).toFixed(1)}°C</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      {METRIC_GROUPS.map(group => (
        <div key={group.label} className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{group.label}</h3>
          <TimeSeriesChart data={data} metrics={group.metrics} height={220} />
        </div>
      ))}

      {data.length === 0 && (
        <div className="card p-12 text-center">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No sensor data in the selected range.</p>
          <p className="text-xs text-slate-400 mt-1">Make sure your Arduino is powered on and publishing to HiveMQ.</p>
        </div>
      )}
    </div>
  );
}
