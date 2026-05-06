import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, CreditCard, Bell, Download } from 'lucide-react';
import API, { formatCurrency, formatDate } from '../utils/api';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function TenantDetailPage() {
  const { id } = useParams();
  const { canEdit } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [payments, setPayments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({ channel: 'both', reminder_type: 'rent_due', message: '' });
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const { data } = await API.get(`/tenants/${id}`);
      setTenant(data.tenant);
      setPayments(data.payments);
      setReminders(data.reminders);
    } catch { toast.error('Failed to load tenant'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const downloadReceipt = async (paymentId, receiptNum) => {
    try {
      const response = await API.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptNum}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download receipt'); }
  };

  const sendReminder = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await API.post('/reminders/send', { tenant_id: id, ...reminderForm });
      toast.success('Reminder sent!');
      setShowReminder(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-forest/20 border-t-forest rounded-full animate-spin" /></div>;
  if (!tenant) return <div className="card text-center py-16"><p>Tenant not found</p></div>;

  const totalPaid = parseFloat(tenant.total_paid) || 0;
  const daysRemaining = Math.ceil((new Date(tenant.tenancy_end) - new Date()) / 86400000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/tenants" className="btn-secondary !py-2"><ArrowLeft size={16} /> Back</Link>
          <div>
            <h1 className="font-display font-bold text-2xl text-gray-900">{tenant.full_name}</h1>
            <span className={tenant.status === 'active' ? 'badge-active' : 'badge-expired'}>{tenant.status}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && <button onClick={() => setShowReminder(true)} className="btn-secondary text-sm"><Bell size={15} /> Send Reminder</button>}
          <Link to="/payments" className="btn-primary text-sm"><CreditCard size={15} /> Record Payment</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Tenant info */}
        <div className="card lg:col-span-2 space-y-4">
          <h3 className="font-semibold border-b pb-3">Tenant Information</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /><span>{tenant.phone}</span></div>
            {tenant.email && <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /><span>{tenant.email}</span></div>}
            {tenant.nin && <div><span className="text-gray-500">NIN: </span><span>{tenant.nin}</span></div>}
            {tenant.next_of_kin_name && <div><span className="text-gray-500">Next of Kin: </span><span>{tenant.next_of_kin_name} {tenant.next_of_kin_phone && `(${tenant.next_of_kin_phone})`}</span></div>}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-3">Tenancy Details</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Property: </span><Link to={`/properties/${tenant.property_id}`} className="text-forest hover:underline">{tenant.property_name}</Link></div>
              {tenant.unit_number && <div><span className="text-gray-500">Unit: </span><span className="font-medium">{tenant.unit_number}</span></div>}
              <div><span className="text-gray-500">Rent: </span><span className="font-semibold text-forest">{formatCurrency(tenant.rent_amount)}</span> <span className="text-gray-400 text-xs">/ {tenant.payment_frequency}</span></div>
              <div><span className="text-gray-500">Frequency: </span><span className="capitalize">{tenant.payment_frequency}</span></div>
              <div><span className="text-gray-500">Start: </span><span>{formatDate(tenant.tenancy_start)}</span></div>
              <div>
                <span className="text-gray-500">End: </span>
                <span className={daysRemaining < 0 ? 'text-red-600 font-medium' : daysRemaining <= 30 ? 'text-amber-600 font-medium' : ''}>{formatDate(tenant.tenancy_end)}</span>
                {daysRemaining > 0 && daysRemaining <= 60 && <span className="ml-1 text-xs text-amber-600">({daysRemaining} days left)</span>}
                {daysRemaining <= 0 && <span className="ml-1 text-xs text-red-600">(expired)</span>}
              </div>
              {tenant.security_deposit > 0 && <div><span className="text-gray-500">Security Deposit: </span><span>{formatCurrency(tenant.security_deposit)}</span></div>}
            </div>
          </div>
        </div>

        {/* Payment summary */}
        <div className="card">
          <h3 className="font-semibold mb-4">Payment Summary</h3>
          <div className="space-y-3">
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-display font-bold text-forest">{formatCurrency(totalPaid)}</div>
              <div className="text-sm text-gray-500">Total Paid</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-700">{formatCurrency(tenant.rent_amount)}</div>
              <div className="text-xs text-gray-500">Rent per period</div>
            </div>
          </div>
          {tenant.notes && <div className="mt-4 pt-4 border-t text-sm"><span className="text-gray-500">Notes: </span>{tenant.notes}</div>}
        </div>
      </div>

      {/* Payments table */}
      <div className="card">
        <h3 className="font-semibold mb-4">Payment History ({payments.length})</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Receipt No', 'Amount', 'Date', 'Method', 'Period', 'Status', ''].map((h, i) => (
                    <th key={i} className={`px-3 py-2.5 text-left text-white font-medium bg-forest ${i === 0 ? 'rounded-tl' : ''} ${i === 6 ? 'rounded-tr' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-xs text-forest">{p.receipt_number}</td>
                    <td className="px-3 py-2.5 font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="px-3 py-2.5">{formatDate(p.payment_date)}</td>
                    <td className="px-3 py-2.5 capitalize text-gray-600">{(p.payment_method || '').replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{formatDate(p.period_from)} — {formatDate(p.period_to)}</td>
                    <td className="px-3 py-2.5">
                      <span className={p.status === 'confirmed' ? 'badge-active' : p.status === 'pending' ? 'badge-warning' : 'badge-expired'}>{p.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => downloadReceipt(p.id, p.receipt_number)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-forest" title="Download receipt">
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reminder modal */}
      <Modal isOpen={showReminder} onClose={() => setShowReminder(false)} title="Send Reminder" size="sm">
        <form onSubmit={sendReminder} className="space-y-4">
          <div>
            <label className="label">Reminder Type</label>
            <select className="input" value={reminderForm.reminder_type} onChange={(e) => setReminderForm(p => ({ ...p, reminder_type: e.target.value }))}>
              <option value="rent_due">Rent Due</option>
              <option value="rent_overdue">Rent Overdue</option>
              <option value="tenancy_expiry">Tenancy Expiry</option>
              <option value="custom">Custom Message</option>
            </select>
          </div>
          <div>
            <label className="label">Channel</label>
            <select className="input" value={reminderForm.channel} onChange={(e) => setReminderForm(p => ({ ...p, channel: e.target.value }))}>
              <option value="both">Email + SMS</option>
              <option value="email">Email Only</option>
              <option value="sms">SMS Only</option>
            </select>
          </div>
          {reminderForm.reminder_type === 'custom' && (
            <div>
              <label className="label">Message</label>
              <textarea className="input" rows={4} value={reminderForm.message} onChange={(e) => setReminderForm(p => ({ ...p, message: e.target.value }))} required placeholder="Type your message..." />
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowReminder(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={sending} className="btn-primary flex-1 justify-center"><Bell size={15} />{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
