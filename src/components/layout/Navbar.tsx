import { Menu, Sun, Moon, LogOut, Wifi, WifiOff, Radio } from 'lucide-react';
import { useAuth }      from '../../context/AuthContext';
import { useTheme }     from '../../context/ThemeContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { Link }         from 'react-router-dom';
import clsx from 'clsx';

interface NavbarProps { onMenuClick: () => void; }

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { logout, user }                        = useAuth();
  const { theme, toggleTheme }                  = useTheme();
  const { connected, lastMqttStatus }           = useWebSocket();
  const mqttConnected = lastMqttStatus?.connected ?? false;

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 flex items-center px-4 gap-3 shrink-0">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* MQTT status pill
      <Link
        to="/mqtt"
        className={clsx(
          'hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors',
          mqttConnected
            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
        )}
        title="MQTT / HiveMQ settings"
      >
        <Radio className="w-3 h-3" />
        {mqttConnected ? 'MQTT Live' : 'MQTT Off'}
      </Link> */}

      {/* WS status pill */}
      <div className={clsx(
        'hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        connected
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
      )}>
        {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {connected ? 'WS Live' : 'WS Off'}
      </div>

      {/* Theme toggle */}
      <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* User + Logout */}
      <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
        <span className="hidden sm:block text-sm text-slate-600 dark:text-slate-400">{user?.name || user?.email}</span>
        <button onClick={logout} className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
