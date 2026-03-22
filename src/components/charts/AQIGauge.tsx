import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface AQIGaugeProps {
  value: number;
}

function getAQIColor(aqi: number): string {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  return '#7c3aed';
}

function getAQILabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  return 'Very Unhealthy';
}

export function AQIGauge({ value }: AQIGaugeProps) {
  const pct = Math.min(value / 300, 1);
  const color = getAQIColor(value);
  const label = getAQILabel(value);

  const gaugeData = [
    { value: pct * 100, fill: color },
    { value: (1 - pct) * 100, fill: 'transparent' },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20">
        <ResponsiveContainer width="100%" height={80}>
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
              strokeWidth={0}
            >
              {gaugeData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-white" style={{ color }}>
            {value}
          </span>
        </div>
      </div>
      <p className="text-sm font-medium mt-1" style={{ color }}>{label}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Air Quality Index</p>
    </div>
  );
}

interface MetricBarChartProps {
  data: { name: string; value: number; fill: string }[];
  title: string;
  height?: number;
}

export function MetricBarChart({ data, title, height = 200 }: MetricBarChartProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700/50" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
