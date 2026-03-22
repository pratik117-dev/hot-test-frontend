import { useEffect, useState, FormEvent } from 'react';
import {
  Radio, Wifi, WifiOff, CheckCircle2, XCircle, AlertTriangle,
  Info, ChevronDown, ChevronUp, Plug, PlugZap, FlaskConical,
  BookOpen, Cpu, Database, Activity, Terminal,
} from 'lucide-react';
import { mqttApi, MqttConnectPayload } from '../services/mqttApi';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth }      from '../context/AuthContext';
import { Spinner }      from '../components/ui/Spinner';
import toast            from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: any }) {
  if (!status) return null;
  if (status.connected)  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Connected
    </span>
  );
  if (status.connecting) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
      <Spinner size="sm" className="w-3 h-3 border-amber-500 border-t-transparent" /> Connecting…
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
      <span className="w-2 h-2 rounded-full bg-slate-400" /> Disconnected
    </span>
  );
}

// ─── Topic + Device ID guide ──────────────────────────────────────────────────

function TopicGuide({ prefix }: { prefix: string }) {
  const [open, setOpen] = useState(false);
  const p = (prefix || 'envirologapp').replace(/\/$/, '');

  const rows = [
    { topic: `${p}/sensors/<deviceId>`,
      payload: '{ "temperature": 24.5, "humidity": 60, "co2": 800, "pm25": 12, "pm10": 22, "noise": 45 }',
      note: 'Full JSON — all metrics in one message (recommended)' },
    { topic: `${p}/sensors/<deviceId>/temperature`, payload: '24.5',  note: 'Single metric — plain float' },
    { topic: `${p}/sensors/<deviceId>/humidity`,    payload: '60.0',  note: 'Single metric — plain float' },
    { topic: `${p}/sensors/<deviceId>/co2`,         payload: '800',   note: 'ppm' },
    { topic: `${p}/sensors/<deviceId>/pm25`,        payload: '12.3',  note: 'µg/m³' },
    { topic: `${p}/sensors/<deviceId>/pm10`,        payload: '22.1',  note: 'µg/m³' },
    { topic: `${p}/sensors/<deviceId>/noise`,       payload: '45.2',  note: 'dB' },
    { topic: `${p}/sensors/<deviceId>/ph`,          payload: '7.2',   note: 'Water quality' },
    { topic: `${p}/sensors/<deviceId>/turbidity`,   payload: '2.5',   note: 'NTU' },
    { topic: `${p}/status/<deviceId>`,
      payload: '{ "status": "ONLINE" }',
      note: 'ONLINE | OFFLINE | MAINTENANCE' },
  ];

  const pythonSnippet = `import paho.mqtt.client as mqtt, json, time, random, ssl

BROKER   = "${p.includes('.hivemq.cloud') ? p : 'YOUR-CLUSTER.s1.eu.hivemq.cloud'}"
PORT     = 8883
USERNAME = "YOUR_USERNAME"
PASSWORD = "YOUR_PASSWORD"
DEVICE   = "YOUR_DEVICE_ID"   # Copy from Devices page

client = mqtt.Client(client_id="my-sensor-01")
client.tls_set(tls_version=ssl.PROTOCOL_TLS)
client.username_pw_set(USERNAME, PASSWORD)
client.connect(BROKER, PORT, keepalive=60)
client.loop_start()

while True:
    payload = {
        "temperature": round(20 + random.random() * 10, 1),
        "humidity":    round(40 + random.random() * 40, 1),
        "co2":         round(400 + random.random() * 600),
        "pm25":        round(5   + random.random() * 30, 1),
        "noise":       round(30  + random.random() * 40, 1),
    }
    client.publish(f"${p}/sensors/{'{DEVICE}'}", json.dumps(payload), qos=1)
    print(f"Published: {payload}")
    time.sleep(5)`;

  const arduinoSnippet = `#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid     = "YOUR_WIFI";
const char* password = "YOUR_WIFI_PASS";
const char* mqtt_server   = "${p.includes('.hivemq.cloud') ? p : 'YOUR-CLUSTER.s1.eu.hivemq.cloud'}";
const char* mqtt_username = "YOUR_USERNAME";
const char* mqtt_password = "YOUR_PASSWORD";
const char* device_id     = "YOUR_DEVICE_ID";  // Copy from Devices page

WiFiClientSecure espClient;
PubSubClient client(espClient);

void publishSensorData() {
  StaticJsonDocument<256> doc;
  doc["temperature"] = 24.5;   // replace with real sensor readings
  doc["humidity"]    = 60.0;
  doc["co2"]         = 800;
  doc["pm25"]        = 12.3;

  char topic[100];
  snprintf(topic, sizeof(topic), "${p}/sensors/%s", device_id);

  char payload[256];
  serializeJson(doc, payload);
  client.publish(topic, payload, true);
}`;

  return (
    <div className="card overflow-hidden border border-blue-200 dark:border-blue-500/20">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">Device Publishing Guide</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Topics, payload format, Python & Arduino examples</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">

          {/* Device ID tip */}
          <div className="p-4">
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">How to get your Device ID</p>
                <p>Go to <strong>Devices</strong> page → click any device → the ID is shown in the card (e.g. <code className="font-mono bg-amber-100 dark:bg-amber-500/20 px-1 rounded">clx9m…</code>).
                Use that exact string as <code className="font-mono bg-amber-100 dark:bg-amber-500/20 px-1 rounded">&lt;deviceId&gt;</code> in the topic.
                Alternatively you can use the device <strong>name</strong> (case-insensitive).</p>
              </div>
            </div>
          </div>

          {/* Topic table */}
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">MQTT Topics</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Topic</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Payload</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rows.map(r => (
                    <tr key={r.topic} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3 font-mono text-brand-600 dark:text-brand-400 break-all">{r.topic}</td>
                      <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300 break-all max-w-xs">{r.payload}</td>
                      <td className="py-2 px-3 text-slate-500 hidden md:table-cell">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Python snippet */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Python (paho-mqtt)</p>
              <code className="ml-auto text-xs text-slate-400 font-mono">pip install paho-mqtt</code>
            </div>
            <pre className="text-xs font-mono bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed">{pythonSnippet}</pre>
          </div>

          {/* Arduino snippet */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-slate-500" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Arduino / ESP32 (PubSubClient)</p>
            </div>
            <pre className="text-xs font-mono bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed">{arduinoSnippet}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dual mode info banner ────────────────────────────────────────────────────

function DualModeBanner() {
  return (
    <div className="card p-4 border border-brand-200 dark:border-brand-500/20 bg-brand-50/30 dark:bg-brand-500/5">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
          <Activity className="w-4 h-4 text-brand-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1">
            Dual Mode Active — Real Device + Simulator running simultaneously
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Your real IoT device data (via HiveMQ MQTT) and the built-in simulator both write to the same
            database and appear on the dashboard at the same time. Simulated devices fill in any gaps
            while your real device is offline or during development.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1.5">
            To disable the simulator, set <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">ENABLE_SIMULATOR=false</code> in <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">server/.env</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Data flow diagram ────────────────────────────────────────────────────────

function DataFlowDiagram() {
  const steps = [
    { icon: '📟', label: 'Your IoT Device', sub: 'Real sensor' },
    { arrow: true },
    { icon: '🐝', label: 'HiveMQ Cloud', sub: 'MQTT broker' },
    { arrow: true },
    { icon: '🖥️', label: 'EnviroLog Server', sub: 'Node.js + MQTT.js' },
    { arrow: true },
    { icon: '🗄️', label: 'PostgreSQL', sub: 'Neon DB' },
    { arrow: true },
    { icon: '📡', label: 'WebSocket', sub: 'Live push' },
    { arrow: true },
    { icon: '📊', label: 'Dashboard', sub: 'Real-time' },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data Pipeline</h3>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) =>
          (s as any).arrow
            ? <span key={i} className="text-slate-400 text-xl font-thin">→</span>
            : (
              <div key={i} className="flex flex-col items-center gap-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl min-w-[80px] text-center">
                <span className="text-xl">{(s as any).icon}</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">{(s as any).label}</span>
                <span className="text-xs text-slate-400 leading-tight">{(s as any).sub}</span>
              </div>
            )
        )}
      </div>
      <p className="text-xs text-slate-400 text-center mt-3">
        Each message is validated → saved to DB → threshold-checked for alerts → pushed to browser via WS
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_FORM: MqttConnectPayload = {
  host:        '',
  port:        8883,
  username:    '',
  password:    '',
  topicPrefix: 'envirologapp',
  useTls:      true,
  clientId:    'envirologapp-server',
};

export default function MqttSettingsPage() {
  const { isAdmin }           = useAuth();
  const { lastMqttStatus }    = useWebSocket();

  const [form, setForm]                   = useState<MqttConnectPayload>(DEFAULT_FORM);
  const [mqttStatus, setMqttStatus]       = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting]       = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting]             = useState(false);
  const [showPass, setShowPass]           = useState(false);
  const [testResult, setTestResult]       = useState<any>(null);

  // Load on mount
  useEffect(() => {
    mqttApi.getStatus()
      .then(r => {
        setMqttStatus(r.data.data.status);
        const cfg = r.data.data.config;
        if (cfg) {
          setForm(prev => ({
            ...prev,
            host:        cfg.host        || prev.host,
            port:        cfg.port        || prev.port,
            username:    cfg.username    || prev.username,
            topicPrefix: cfg.topicPrefix || prev.topicPrefix,
            useTls:      cfg.useTls      ?? prev.useTls,
            clientId:    cfg.clientId    || prev.clientId,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  // Live updates from WebSocket
  useEffect(() => { if (lastMqttStatus) setMqttStatus(lastMqttStatus); }, [lastMqttStatus]);

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.host || !form.username || !form.password) {
      return toast.error('Host, username and password are required');
    }
    setConnecting(true);
    try {
      const res = await mqttApi.connect(form);
      setMqttStatus(res.data.data);
      toast.success('Connecting to HiveMQ Cloud…');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Connection failed');
    } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await mqttApi.disconnect();
      setMqttStatus(res.data.data);
      toast.success('MQTT disconnected');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Disconnect failed');
    } finally { setDisconnecting(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await mqttApi.testPublish();
      setTestResult(res.data);
      toast.success('Test reading published!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Test failed — is MQTT connected?');
    } finally { setTesting(false); }
  };

  const set = (k: keyof MqttConnectPayload) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm(prev => ({ ...prev, [k]: val }));
    };

  const isConnected  = !!mqttStatus?.connected;
  const isConnecting = !!mqttStatus?.connecting;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-brand-500" /> HiveMQ Cloud
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Connect your IoT device via MQTT — readings save to DB and stream live to the dashboard
          </p>
        </div>
        {!loadingStatus && <StatusBadge status={mqttStatus} />}
      </div>

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="card p-4 flex gap-3 border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Only admins can configure MQTT. You can view the current status here.
          </p>
        </div>
      )}

      {/* Dual mode banner */}
      <DualModeBanner />

      {/* ── Live stats ─────────────────────────────────────────────────────── */}
      {!loadingStatus && mqttStatus && (
        <div className={clsx('card p-5 border', isConnected
          ? 'border-emerald-200 dark:border-emerald-500/20'
          : 'border-slate-200 dark:border-slate-700')}>
          <div className="flex items-center gap-2 mb-4">
            {isConnected ? <Wifi className="w-4 h-4 text-emerald-500" /> : <WifiOff className="w-4 h-4 text-slate-400" />}
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Connection Status</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
            {[
              { label: 'Broker',           value: mqttStatus.host || '—' },
              { label: 'Messages Received', value: (mqttStatus.messagesReceived ?? 0).toLocaleString() },
              { label: 'Readings Saved',    value: (mqttStatus.readingsSaved    ?? 0).toLocaleString() },
              { label: 'Connected',         value: mqttStatus.lastConnectedAt
                  ? formatDistanceToNow(new Date(mqttStatus.lastConnectedAt), { addSuffix: true }) : '—' },
              { label: 'Last Error',        value: mqttStatus.lastError || 'None' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3">
                <p className="text-slate-500 mb-0.5">{label}</p>
                <p className="font-medium text-slate-800 dark:text-white truncate" title={String(value)}>{value}</p>
              </div>
            ))}
          </div>

          {isConnected && isAdmin && (
            <div className="flex flex-wrap gap-2">
              <button onClick={handleTest} disabled={testing}
                className="btn-secondary flex items-center gap-2 text-sm">
                {testing ? <Spinner size="sm" /> : <FlaskConical className="w-4 h-4" />}
                Send Test Reading
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting}
                className="btn-danger flex items-center gap-2 text-sm">
                {disconnecting
                  ? <Spinner size="sm" className="border-white border-t-transparent" />
                  : <PlugZap className="w-4 h-4" />}
                Disconnect
              </button>
            </div>
          )}

          {testResult && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Published to <code className="font-mono text-brand-600 dark:text-brand-400">{testResult.data?.topic}</code>
                </span>
              </div>
              <pre className="font-mono text-slate-500 dark:text-slate-400 overflow-x-auto">
                {JSON.stringify(testResult.data?.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Connect form (admin only) ───────────────────────────────────────── */}
      {isAdmin && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <Plug className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
              {isConnected ? 'Update / Reconnect' : 'Connect to HiveMQ Cloud'}
            </h3>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            {/* Host + Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label">Broker Hostname *</label>
                <input
                  value={form.host}
                  onChange={set('host')}
                  className="input font-mono text-sm"
                  placeholder="abc123.s1.eu.hivemq.cloud"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Found in HiveMQ Cloud → <strong>Manage Cluster</strong> → <strong>Overview</strong>
                </p>
              </div>
              <div>
                <label className="label">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={set('port')}
                  className="input font-mono text-sm"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">8883 for TLS</p>
              </div>
            </div>

            {/* Credentials */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Username *</label>
                <input value={form.username} onChange={set('username')} className="input" placeholder="hivemq-user" required />
                <p className="text-xs text-slate-400 mt-1">Manage Cluster → Credentials</p>
              </div>
              <div>
                <label className="label">Password *</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    className="input pr-14"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>

            {/* Topic prefix + Client ID */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Topic Prefix</label>
                <input value={form.topicPrefix} onChange={set('topicPrefix')} className="input font-mono text-sm" placeholder="envirologapp" />
                <p className="text-xs text-slate-400 mt-1">Subscribes to <code className="font-mono">{form.topicPrefix || 'envirologapp'}/sensors/#</code></p>
              </div>
              <div>
                <label className="label">Client ID</label>
                <input value={form.clientId} onChange={set('clientId')} className="input font-mono text-sm" placeholder="envirologapp-server" />
              </div>
            </div>

            {/* TLS */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
              <input id="tls" type="checkbox" checked={form.useTls} onChange={set('useTls')} className="w-4 h-4 accent-brand-500" />
              <label htmlFor="tls" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer flex-1">
                Use TLS/SSL (mqtts — required for HiveMQ Cloud)
              </label>
              {form.useTls && (
                <span className="badge bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Secure
                </span>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={connecting || isConnecting}
                className="btn-primary flex items-center gap-2">
                {(connecting || isConnecting)
                  ? <><Spinner size="sm" className="border-white border-t-transparent" /> Connecting…</>
                  : <><Plug className="w-4 h-4" /> {isConnected ? 'Reconnect' : 'Connect'}</>}
              </button>
              {isConnected && (
                <button type="button" onClick={handleDisconnect} disabled={disconnecting}
                  className="btn-danger flex items-center gap-2">
                  {disconnecting
                    ? <Spinner size="sm" className="border-white border-t-transparent" />
                    : <XCircle className="w-4 h-4" />}
                  Disconnect
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Topic / device guide */}
      <TopicGuide prefix={form.topicPrefix || 'envirologapp'} />

      {/* Data flow */}
      <DataFlowDiagram />
    </div>
  );
}
