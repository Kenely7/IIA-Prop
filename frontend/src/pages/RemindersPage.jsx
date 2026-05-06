import { useState, useEffect, useCallback } from 'react';
import api, { formatDate } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import {
  BellIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  PlayIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const CHANNEL_ICONS = {
  email: EnvelopeIcon,
  sms: DevicePhoneMobileIcon,
  both: BellIcon,
};

const STATUS_CONFIG = {
  sent: { cls: 'badge-success', icon: CheckCircleIcon, label: 'Sent' },
  failed: { cls: 'badge-danger', icon: XCircleIcon, label: 'Failed' },
  pending: { cls: 'badge-warning', icon: ClockIcon, label: 'Pending' },
};

const TYPE_LABELS = {
  rent_due: 'Rent Due',
  overdue: 'Overdue Notice',
  expiry: 'Tenancy Expiry',
  manual: 'Manual',
};

export default function RemindersPage() {
  const { isAdmin } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({
    tenant_id: '',
    reminder_type: 'rent_due',
    channel: 'both',
    message: '',
  });
  const [sending, setSending] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, tRes] = await Promise.all([
        api.get('/reminders'),
        api.get('/tenants'),
      ]);
      setReminders(rRes.data.reminders || []);
      setTenants(tRes.data.tenants || []);
    } catch {
      toast.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runJob = async () => {
    if (!window.confirm('Run daily reminder job now? This will send reminders to all eligible tenants.')) return;
    setRunning(true);
    try {
      const res = await api.post('/reminders/run-job');
      toast.success(`Job complete: ${res.data.sent} sent, ${res.data.failed} failed`);
      fetchAll();
    } catch {
      toast.error('Failed to run reminder job');
    } finally {
      setRunning(false);
    }
  };

  const sendManual = async () => {
    if (!form.tenant_id) { toast.error('Select a tenant'); return; }
    setSending(true);
    try {
      await api.post('/reminders/send', form);
      toast.success('Reminder sent successfully');
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reminder');
    } finally {
      setSending(false);
    }
  };

  const filtered = reminders.filter(r => {
    const matchSearch = !search || r.tenant_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || r.reminder_type === typeFilter;
    return matchSearch && matchType;
  });

  const stats = {
    total: reminders.length,
    sent: reminders.filter(r => r.status === 'sent').length,
    failed: reminders.filter(r => r.status === 'failed').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>Reminders</h1>
          <p className="text-sm text-gray-500 mt-0.5">SMS & email notification history</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowModal(true)} className="btn-secondary flex items-center gap-2">
            <PaperAirplaneIcon className="w-4 h-4" />
            Send Reminder
          </button>
          {isAdmin && (
            <button onClick={runJob} disabled={running} className="btn-primary flex items-center gap-2">
              <PlayIcon className="w-4 h-4" />
              {running ? 'Running...' : 'Run Daily Job'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>{stats.total}</p>
          <p className="text-sm text-gray-500 mt-1">Total Sent</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-700" style={{ fontFamily: 'Sora, sans-serif' }}>{stats.sent}</p>
          <p className="text-sm text-gray-500 mt-1">Delivered</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600" style={{ fontFamily: 'Sora, sans-serif' }}>{stats.failed}</p>
          <p className="text-sm text-gray-500 mt-1">Failed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search tenant..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No reminders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Channel</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Sent At</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const SIcon = sc.icon;
                  const CIcon = CHANNEL_ICONS[r.channel] || BellIcon;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{r.tenant_name}</div>
                        <div className="text-xs text-gray-400">{r.property_name}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="badge badge-default">{TYPE_LABELS[r.reminder_type] || r.reminder_type}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <CIcon className="w-4 h-4" />
                          <span className="capitalize">{r.channel}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${sc.cls} flex items-center gap-1 w-fit`}>
                          <SIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate text-xs">{r.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Reminder Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Send Manual Reminder" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Tenant *</label>
            <select className="input w-full" value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}>
              <option value="">Select tenant...</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.unit_number}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Reminder Type</label>
              <select className="input w-full" value={form.reminder_type} onChange={e => setForm(f => ({ ...f, reminder_type: e.target.value }))}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Channel</label>
              <select className="input w-full" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                <option value="both">Both (SMS + Email)</option>
                <option value="sms">SMS Only</option>
                <option value="email">Email Only</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Custom Message (optional)</label>
            <textarea
              className="input w-full"
              rows={3}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Leave blank to use default template..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={sendManual} disabled={sending}>
              <PaperAirplaneIcon className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
