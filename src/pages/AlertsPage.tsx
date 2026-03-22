import { useEffect, useState, useCallback } from 'react';
import { Bell, CheckCircle, Filter, X, AlertTriangle } from 'lucide-react';
import { alertsApi } from '../services/api';
import { SeverityBadge } from '../components/ui/Badges';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import { useWebSocket } from '../context/WebSocketContext';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

// ── Local dismissable toast (mirrors WebSocketContext pattern) ────────────────
function showToast(message: string, type: 'success' | 'error') {
  const toastId = `alerts-${type}-${Date.now()}`;
  toast.custom(
    (t) => (
      <div className={`
        flex items-center gap-3 w-72 rounded-xl shadow-lg px-4 py-3
        bg-white dark:bg-slate-800
        border ${type === 'error'
          ? 'border-red-200 dark:border-red-500/30'
          : 'border-emerald-200 dark:border-emerald-500/30'}
        transition-all duration-300
        ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}>
        <div className={`
          w-7 h-7 rounded-lg flex items-center justify-center shrink-0
          ${type === 'error'
            ? 'bg-red-100 dark:bg-red-500/20'
            : 'bg-emerald-100 dark:bg-emerald-500/20'}
        `}>
          {type === 'error'
            ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          }
        </div>
        <p className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200">
          {message}
        </p>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    ),
    { id: toastId, duration: 4000, position: 'top-right' },
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { lastAlert } = useWebSocket();
  const [alerts,    setAlerts]    = useState<any[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<{ resolved?: string; severity?: string }>({});
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await alertsApi.getAll({ ...filter, limit: 100 });
      setAlerts(res.data.data);
      setTotal(res.data.total);
    } catch {
      showToast('Failed to load alerts', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Prepend new incoming alerts from WebSocket
  useEffect(() => {
    if (lastAlert) {
      setAlerts(prev => [lastAlert, ...prev]);
      setTotal(t => t + 1);
    }
  }, [lastAlert]);

  const resolveAlert = async (id: string) => {
    setResolving(id);
    try {
      await alertsApi.resolve(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
      showToast('Alert resolved', 'success');
    } catch {
      showToast('Failed to resolve alert', 'error');
    } finally {
      setResolving(null);
    }
  };

  const unresolvedCount = alerts.filter(a => !a.resolved).length;

  if (loading) return <PageLoader message="Loading alerts..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {unresolvedCount > 0 ? (
              <span className="text-amber-500">
                {unresolvedCount} unresolved alert{unresolvedCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-emerald-500">All clear — no active alerts</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <Filter className="w-4 h-4 text-slate-400 self-center" />
        <div>
          <label className="label text-xs">Status</label>
          <select
            value={filter.resolved ?? ''}
            onChange={e => setFilter(f => ({ ...f, resolved: e.target.value || undefined }))}
            className="input w-32 text-xs py-1.5"
          >
            <option value="">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Severity</label>
          <select
            value={filter.severity ?? ''}
            onChange={e => setFilter(f => ({ ...f, severity: e.target.value || undefined }))}
            className="input w-36 text-xs py-1.5"
          >
            <option value="">All</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-slate-500 self-end">{total} total</span>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alerts"
          description="Alerts will appear here when sensor thresholds are exceeded"
        />
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`card p-4 flex items-start gap-4 transition-opacity ${alert.resolved ? 'opacity-60' : ''}`}
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                alert.severity === 'CRITICAL' ? 'bg-red-500'    :
                alert.severity === 'HIGH'     ? 'bg-orange-500' :
                alert.severity === 'MEDIUM'   ? 'bg-amber-500'  : 'bg-blue-500'
              } ${!alert.resolved && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH')
                  ? 'animate-pulse' : ''
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <SeverityBadge severity={alert.severity} />
                  {alert.resolved && (
                    <span className="badge bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> Resolved
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1">
                  {alert.device && (
                    <span className="text-xs text-slate-500">
                      {alert.device.name} · {alert.device.location}
                    </span>
                  )}
                  <span
                    className="text-xs text-slate-400"
                    title={format(new Date(alert.createdAt), 'PPpp')}
                  >
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {!alert.resolved && (
                <button
                  onClick={() => resolveAlert(alert.id)}
                  disabled={resolving === alert.id}
                  className="shrink-0 text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
                >
                  {resolving === alert.id ? 'Resolving...' : 'Resolve'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}