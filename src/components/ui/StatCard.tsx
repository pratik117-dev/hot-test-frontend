import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'cyan';
  trend?: { value: number; label: string };
  subtitle?: string;
  loading?: boolean;
}

const colorMap = {
  green:  { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', border: 'border-emerald-500/20' },
  blue:   { bg: 'bg-blue-500/10',    icon: 'text-blue-500',    border: 'border-blue-500/20' },
  yellow: { bg: 'bg-amber-500/10',   icon: 'text-amber-500',   border: 'border-amber-500/20' },
  red:    { bg: 'bg-red-500/10',     icon: 'text-red-500',     border: 'border-red-500/20' },
  purple: { bg: 'bg-purple-500/10',  icon: 'text-purple-500',  border: 'border-purple-500/20' },
  cyan:   { bg: 'bg-cyan-500/10',    icon: 'text-cyan-500',    border: 'border-cyan-500/20' },
};

export default function StatCard({ title, value, unit, icon: Icon, color, trend, subtitle, loading }: StatCardProps) {
  const c = colorMap[color];

  return (
    <div className={clsx('card p-5 border', c.border, 'transition-all duration-200 hover:shadow-md')}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{value}</span>
              {unit && <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
            </div>
          )}
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <p className={clsx('text-xs mt-1', trend.value >= 0 ? 'text-emerald-500' : 'text-red-500')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3', c.bg)}>
          <Icon className={clsx('w-5 h-5', c.icon)} />
        </div>
      </div>
    </div>
  );
}
