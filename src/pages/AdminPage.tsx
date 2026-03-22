import { useEffect, useState, useCallback } from 'react';
import { Shield, Users, Cpu, Activity, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { adminApi } from '../services/api';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import StatCard from '../components/ui/StatCard';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';

type Tab = 'overview' | 'users' | 'logs';

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await adminApi.getStats();
        setStats(res.data.data);
      } else if (tab === 'users') {
        const res = await adminApi.getUsers();
        setUsers(res.data.data);
      } else {
        const res = await adminApi.getLogs({ limit: 100 });
        setLogs(res.data.data);
      }
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await adminApi.updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch { toast.error('Failed to update role'); }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user and all their data?')) return;
    try {
      await adminApi.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted');
    } catch { toast.error('Failed to delete user'); }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'logs', label: 'System Logs', icon: Shield },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" /> Admin Panel
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">System management and monitoring</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <>
          {/* Overview */}
          {tab === 'overview' && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Total Users"    value={stats.totalUsers}     icon={Users}    color="blue" />
                <StatCard title="Total Devices"  value={stats.totalDevices}   icon={Cpu}      color="green" />
                <StatCard title="Online Devices" value={stats.onlineDevices}  icon={Activity} color="cyan" subtitle={`of ${stats.totalDevices}`} />
                <StatCard title="Total Alerts"   value={stats.totalAlerts}    icon={Shield}   color="yellow" />
                <StatCard title="Open Alerts"    value={stats.unresolvedAlerts} icon={Shield} color="red" />
                <StatCard title="Total Readings" value={stats.totalReadings.toLocaleString()} icon={Activity} color="purple" />
              </div>
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                    <tr>
                      {['User', 'Role', 'Devices', 'Joined', 'Actions'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{u.name || '—'}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge ${u.role === 'ADMIN' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{u._count?.devices ?? 0}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {u.id !== currentUser?.id && (
                              <>
                                <button
                                  onClick={() => toggleRole(u.id, u.role)}
                                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                                  title={`Make ${u.role === 'ADMIN' ? 'User' : 'Admin'}`}
                                >
                                  {u.role === 'ADMIN' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {u.id === currentUser?.id && <span className="text-xs text-slate-400">You</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && <EmptyState icon={Users} title="No users found" />}
              </div>
            </div>
          )}

          {/* System Logs */}
          {tab === 'logs' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                    <tr>
                      {['Action', 'User ID', 'Details', 'Time'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 px-4">
                          <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 font-mono">{log.userId ? log.userId.slice(0, 8) + '...' : '—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">{log.details || '—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-500" title={format(new Date(log.createdAt), 'PPpp')}>
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logs.length === 0 && <EmptyState icon={Shield} title="No logs yet" />}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
