import { useState, useEffect, useCallback } from 'react';
import api, { formatCurrency, formatDate } from '../utils/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

const METHOD_LABELS = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  pos: 'POS',
  online: 'Online',
  cheque: 'Cheque',
};

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', icon: CheckCircleIcon, cls: 'badge-success' },
  pending: { label: 'Pending', icon: ClockIcon, cls: 'badge-warning' },
  failed: { label: 'Failed', icon: XCircleIcon, cls: 'badge-danger' },
  reversed: { label: 'Reversed', icon: XCircleIcon, cls: 'badge-danger' },
};

export default function PaymentsPage() {
  const { canEdit } = useAuth();
  const [payments, setPayments] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [form, setForm] = useState({
    tenant_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    period_from: '',
    period_to: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, tRes, prRes] = await Promise.all([
        api.get('/payments', { params: { search, status: statusFilter, property_id: propertyFilter } }),
        api.get('/tenants'),
        api.get('/properties'),
      ]);
      setPayments(pRes.data.payments || []);
      setTenants(tRes.data.tenants || []);
      setProperties(prRes.data.properties || []);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, propertyFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setSelectedPayment(null);
    setForm({
      tenant_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      period_from: '',
      period_to: '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleTenantChange = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    setForm(f => ({
      ...f,
      tenant_id: tenantId,
      amount: tenant ? tenant.rent_amount : '',
    }));
  };

  const handleSubmit = async () => {
    if (!form.tenant_id || !form.amount || !form.payment_date) {
      toast.error('Tenant, amount, and date are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/payments', form);
      toast.success('Payment recorded successfully');
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async () => {
    try {
      await api.delete(`/payments/${selectedPayment.id}`);
      toast.success('Payment reversed');
      setShowDeleteDialog(false);
      fetchAll();
    } catch {
      toast.error('Failed to reverse payment');
    }
  };

  const downloadReceipt = async (paymentId) => {
    setDownloading(paymentId);
    try {
      const res = await api.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${paymentId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download receipt');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{payments.length} records found</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            Record Payment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search tenant, receipt..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>
        <select className="input" value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
          <option value="">All Properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCardIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Receipt #</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Property</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Method</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => {
                  const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                  const Icon = sc.icon;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{p.receipt_number}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{p.tenant_name}</div>
                        <div className="text-xs text-gray-400">{p.unit_number}</div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{p.property_name}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-3.5 text-gray-600">{METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                      <td className="px-5 py-3.5 text-gray-600">{formatDate(p.payment_date)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${sc.cls} flex items-center gap-1 w-fit`}>
                          <Icon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadReceipt(p.id)}
                            disabled={downloading === p.id}
                            className="text-primary-600 hover:text-primary-800 font-medium text-xs flex items-center gap-1"
                          >
                            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                            {downloading === p.id ? 'Downloading...' : 'Receipt'}
                          </button>
                          {canEdit && p.status === 'confirmed' && (
                            <button
                              onClick={() => { setSelectedPayment(p); setShowDeleteDialog(true); }}
                              className="text-red-500 hover:text-red-700 font-medium text-xs"
                            >
                              Reverse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Payment" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Tenant *</label>
            <select className="input w-full" value={form.tenant_id} onChange={e => handleTenantChange(e.target.value)}>
              <option value="">Select tenant...</option>
              {tenants.filter(t => t.status === 'active').map(t => (
                <option key={t.id} value={t.id}>{t.full_name} — {t.unit_number}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₦) *</label>
              <input className="input w-full" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Payment Date *</label>
              <input className="input w-full" type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input w-full" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Period From</label>
              <input className="input w-full" type="date" value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} />
            </div>
            <div>
              <label className="label">Period To</label>
              <input className="input w-full" type="date" value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input w-full" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reverse Confirm */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleReverse}
        title="Reverse Payment"
        message={`Reverse ${formatCurrency(selectedPayment?.amount)} payment from ${selectedPayment?.tenant_name}? This action cannot be undone.`}
        confirmLabel="Reverse Payment"
        isDanger
      />
    </div>
  );
}
