import {
  createContext, useContext, useEffect, useRef,
  useState, ReactNode, useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { X, AlertTriangle, Flame } from 'lucide-react';

// ── Custom dismissable alert toast ────────────────────────────────────────────
// Uses a fixed id per alert type so rapid duplicate alerts replace the existing
// toast instead of stacking a new one on every WebSocket message.
function showAlertToast(message: string, severity: string) {
  const isFlame    = message.toLowerCase().includes('flame');
  const isCritical = severity === 'CRITICAL';

  // Fixed id per type — new alert of same type updates the existing toast
  const toastId = isFlame ? 'alert-flame' : `alert-${severity.toLowerCase()}`;

  // Dismiss any existing toast of the same type before showing the new one
  toast.dismiss(toastId);

  toast.custom(
    (t) => (
      <div
        className={`
          flex items-start gap-3 w-80 rounded-xl shadow-lg px-4 py-3
          bg-white dark:bg-slate-800
          border ${isCritical || isFlame
            ? 'border-red-300 dark:border-red-500/50'
            : 'border-orange-200 dark:border-orange-500/30'}
          transition-all duration-300
          ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        `}
      >
        {/* Icon */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5
          ${isCritical || isFlame ? 'bg-red-100 dark:bg-red-500/20' : 'bg-orange-100 dark:bg-orange-500/20'}
        `}>
          {isFlame
            ? <Flame className="w-4 h-4 text-red-500" />
            : <AlertTriangle className="w-4 h-4 text-orange-500" />
          }
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${isCritical || isFlame ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {isFlame ? '🔥 FLAME DETECTED' : `⚠️ ${severity}`}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words leading-relaxed">
            {message}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ),
    {
      id:       toastId,   // fixed id = deduplication
      duration: 6000,
      position: 'top-right',
    },
  );
}

// ── Context types ─────────────────────────────────────────────────────────────
interface WsContextType {
  connected:        boolean;
  lastSensorData:   any | null;
  lastAlert:        any | null;
  lastMqttStatus:   any | null;
  lastDeviceStatus: any | null;
  subscribe: (handler: (msg: any) => void) => () => void;
}

const WsContext = createContext<WsContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const wsRef            = useRef<WebSocket | null>(null);
  const handlersRef      = useRef<Set<(msg: any) => void>>(new Set());
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const [connected,        setConnected]        = useState(false);
  const [lastSensorData,   setLastSensorData]   = useState<any>(null);
  const [lastAlert,        setLastAlert]        = useState<any>(null);
  const [lastMqttStatus,   setLastMqttStatus]   = useState<any>(null);
  const [lastDeviceStatus, setLastDeviceStatus] = useState<any>(null);

  const connect = useCallback(() => {
    if (!token) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:3001?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { setConnected(true); };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'SENSOR_DATA') {
            setLastSensorData(msg.payload);
          }

          if (msg.type === 'ALERT') {
            setLastAlert(msg.payload);
            const sev = msg.payload?.severity ?? '';
            if (sev === 'CRITICAL' || sev === 'HIGH') {
              // Use custom toast so the X button actually dismisses it
              showAlertToast(msg.payload.message ?? 'Alert received', sev);
            }
          }

          if (msg.type === 'MQTT_STATUS')   setLastMqttStatus(msg.payload);
          if (msg.type === 'DEVICE_STATUS') setLastDeviceStatus(msg.payload);

          handlersRef.current.forEach(h => h(msg));
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();

    } catch (err) {
      console.error('WS connect error:', err);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((handler: (msg: any) => void) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  return (
    <WsContext.Provider value={{
      connected, lastSensorData, lastAlert,
      lastMqttStatus, lastDeviceStatus, subscribe,
    }}>
      {children}
    </WsContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useWebSocket() {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider');
  return ctx;
}