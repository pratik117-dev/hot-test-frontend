import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Cpu, Activity, Bell, FileText, Shield, X, Leaf, Radio } from 'lucide-react';
import { useAuth }      from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/devices',    icon: Cpu,             label: 'Devices' },
  { to: '/alerts',     icon: Bell,            label: 'Alerts' },
  { to: '/reports',    icon: FileText,        label: 'Reports' },
];

interface SidebarProps { open: boolean; onClose: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, isAdmin }  = useAuth();
  const { connected, lastMqttStatus } = useWebSocket();
  const mqttConnected = lastMqttStatus?.connected ?? false;

  return (
    <aside className={clsx(
      'fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 dark:bg-slate-950 flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-semibold text-sm leading-none block">EnviroLog</span>
            <span className="text-slate-500 text-xs">v1.1.0</span>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {/* Show MQTT connection dot next to MQTT nav item */}
            {to === '/mqtt' && (
              <span className={clsx('w-2 h-2 rounded-full shrink-0', mqttConnected ? 'bg-brand-500 animate-pulse' : 'bg-slate-600')} />
            )}
          </NavLink>
        ))}

        {/* {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Admin</p>
            </div>
            <NavLink
              to="/admin"
              onClick={onClose}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              Admin Panel
            </NavLink>
          </>
        )} */}
      </nav>

      {/* Bottom user info */}
      <div className="p-3 border-t border-slate-700/50">
        {/* MQTT status mini-bar */}
        {/* <div className={clsx(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2 text-xs',
          mqttConnected
            ? 'bg-brand-500/10 text-brand-400'
            : 'bg-slate-800 text-slate-500'
        )}>
          <Radio className="w-3 h-3 shrink-0" />
          <span className="flex-1">MQTT: {mqttConnected ? 'Live' : 'Not connected'}</span>
          <span className={clsx('w-1.5 h-1.5 rounded-full', mqttConnected ? 'bg-brand-500 animate-pulse' : 'bg-slate-600')} />
        </div> */}

        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 text-xs font-bold uppercase">
            {user?.name?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">{user?.name || user?.email}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role}</p>
          </div>
          <div className={clsx('w-2 h-2 rounded-full', connected ? 'bg-brand-500 animate-pulse' : 'bg-slate-600')} title={connected ? 'WS Live' : 'WS Offline'} />
        </div>
      </div>
    </aside>
  );
}
