import clsx from 'clsx';

type Status = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function DeviceStatusBadge({ status }: { status: Status }) {
  const map = {
    ONLINE:      { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Online' },
    OFFLINE:     { dot: 'bg-slate-400',   text: 'text-slate-600 dark:text-slate-400',     bg: 'bg-slate-100 dark:bg-slate-700/50',     label: 'Offline' },
    MAINTENANCE: { dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-500/10',      label: 'Maintenance' },
  };
  const s = map[status];
  return (
    <span className={clsx('badge', s.bg, s.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot, status === 'ONLINE' && 'animate-pulse')} />
      {s.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map = {
    LOW:      'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    MEDIUM:   'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    HIGH:     'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400',
    CRITICAL: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return <span className={clsx('badge', map[severity])}>{severity}</span>;
}

export function DeviceTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    AIR_QUALITY: 'Air Quality',
    WEATHER: 'Weather',
    NOISE: 'Noise',
    WATER: 'Water',
    MULTI_SENSOR: 'Multi-Sensor',
  };
  return (
    <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
      {labels[type] || type}
    </span>
  );
}
