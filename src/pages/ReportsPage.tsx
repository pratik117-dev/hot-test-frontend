import { useEffect, useState } from 'react';
import { FileText, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { reportsApi, devicesApi } from '../services/api';
import { PageLoader } from '../components/ui/Spinner';
import { MetricBarChart } from '../components/charts/AQIGauge';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [range, setRange] = useState('7');

  const getDateRange = () => ({
    startDate: subDays(new Date(), parseInt(range)).toISOString(),
    endDate: new Date().toISOString(),
  });

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getSummary({ ...getDateRange(), deviceId: deviceId || undefined });
      setSummary(res.data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    devicesApi.getAll().then(r => setDevices(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchSummary(); }, [range, deviceId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportsApi.exportCSV({ ...getDateRange(), deviceId: deviceId || undefined });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `envirologapp-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const barData = summary ? [
    { name: 'Temp avg', value: summary.temperature.avg ?? 0, fill: '#f97316' },
    { name: 'Humidity avg', value: summary.humidity.avg ?? 0, fill: '#3b82f6' },
    { name: 'CO₂ avg', value: (summary.co2.avg ?? 0) / 10, fill: '#8b5cf6' }, // scaled
    { name: 'PM2.5 avg', value: summary.pm25.avg ?? 0, fill: '#06b6d4' },
    { name: 'Noise avg', value: summary.noise.avg ?? 0, fill: '#f43f5e' },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Environmental data summaries & exports</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label text-xs">Device</label>
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="input w-48 text-xs py-1.5">
            <option value="">All Devices</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Date Range</label>
          <select value={range} onChange={e => setRange(e.target.value)} className="input w-36 text-xs py-1.5">
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      {loading ? <PageLoader message="Generating report..." /> : summary && (
        <>
          {/* Summary header */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Summary</h3>
              <span className="ml-auto text-xs text-slate-500">
                {format(new Date(summary.period.from), 'MMM d')} – {format(new Date(summary.period.to), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.readings.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Readings</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-500">{summary.alerts}</p>
                <p className="text-xs text-slate-500 mt-0.5">Alerts Triggered</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-500">{summary.temperature.max ?? '--'}°</p>
                <p className="text-xs text-slate-500 mt-0.5">Peak Temperature</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-purple-500">{summary.co2.max ?? '--'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Peak CO₂ (ppm)</p>
              </div>
            </div>
          </div>

          {/* Metric detail table */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Metric Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Metric', 'Average', 'Min', 'Max'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {[
                    { label: 'Temperature (°C)', key: 'temperature' },
                    { label: 'Humidity (%)', key: 'humidity' },
                    { label: 'CO₂ (ppm)', key: 'co2' },
                    { label: 'PM2.5 (µg/m³)', key: 'pm25' },
                    { label: 'Noise (dB)', key: 'noise' },
                  ].map(({ label, key }) => {
                    const m = summary[key];
                    return (
                      <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">{label}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{m.avg ?? '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{m.min ?? '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{m.max ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar chart */}
          <div className="card p-5">
            <MetricBarChart data={barData} title="Average Values Comparison" height={220} />
            <p className="text-xs text-slate-400 mt-2">* CO₂ values scaled by ÷10 for chart readability</p>
          </div>
        </>
      )}
    </div>
  );
}
