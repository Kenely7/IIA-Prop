import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, Plus, Search, Phone, Eye, Edit, Trash2, Filter } from 'lucide-react';
import API, { formatCurrency, formatDate, formatDateInput } from '../utils/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const FREQ = ['monthly', 'quarterly', 'biannually', 'annually'];

const initForm = {
  full_name: '', phone: '', email: '', nin: '',
  next_of_kin_name: '', next_of_kin_phone: '',
  property_id: '', unit_id: '', rent_amount: '',
  payment_frequency: 'monthly', tenancy_start: '', tenancy_end: '',
  security_deposit: '', notes: ''
};

export default function TenantsPage() {
  const { canEdit, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [propFilter, setPropFilter] = useState(searchParams.get('property_id') || '');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = { search, status: statusFilter, property_id: propFilter };
      const [tRes, pRes] = await Promise.all([
        API.get('/tenants', { params }),
        API.get('/properties'),
      ]);
      setTenants(tRes.data.tenants);
      setProperties(pRes.data.properties);
    } catch { toast.error('Failed to load tenants'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter, propFilter]);

  const loadUnits = async (propertyId) => {
    if (!propertyId) { setUnits([]); return; }
    try {
      const { data } = await API.get(`/properties/${propertyId}/units`);
      setUnits(data.units.filter(u => u.status !== 'occupied' || u.id === form.unit_id));
    } catch { setUnits([]); }
  };

  const openCreate = () => { setForm(initForm); setEditItem(null); setUnits([]); setShowModal(true); };
  const openEdit = (t) => {
    setForm({
      ...t,
      tenancy_start: formatDateInput(t.tenancy_start),
      tenancy_end: formatDateInput(t.tenancy_end),
    });
    setEditItem(t);
    loadUnits(t.property_id);
    setShowModal(true);
  };

  const f = (k) => (e) => {
    const val = e.target.value;
    setForm(p => ({ ...p, [k]: val }));
    if (k === 'property_id') loadUnits(val);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, unit_id: form.unit_id || null, security_deposit: form.security_deposit || 0 };
      if (editItem) {
        await API.put(`/tenants/${editItem.id}`, payload);
        toast.success('Tenant updated');
      } else {
        await API.post('/tenants', payload);
        toast.success('Tenant created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/tenants/${deleteId}`);
      toast.success('Tenant removed');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Tenants</h1>
          <p className="text-gray-500 text-sm">{tenants.length} tenants</p>
        </div>
        {canEdit && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Tenant</button>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
        <select className="input w-48" value={propFilter} onChange={(e) => setPropFilter(e.target.value)}>
          <option value="">All Properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
      ) : tenants.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tenants found</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Tenant', 'Property', 'Rent', 'Tenancy Period', 'Status', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-left text-white font-medium bg-forest ${i === 0 ? 'rounded-tl-lg' : ''} ${i === 5 ? 'rounded-tr-lg' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                    <td className="px-4 py-3">
                      <Link to={`/tenants/${t.id}`} className="font-medium text-forest hover:underline">{t.full_name}</Link>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><Phone size={11} />{t.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.property_name}
                      {t.unit_number && <div className="text-xs text-gray-400">{t.unit_number}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(t.rent_amount)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{formatDate(t.tenancy_start)}</div>
                      <div className="text-xs text-gray-400">to {formatDate(t.tenancy_end)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={t.status === 'active' ? 'badge-active' : t.status === 'expired' ? 'badge-expired' : 'badge-vacant'}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={`/tenants/${t.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-forest"><Eye size={15} /></Link>
                        {canEdit && <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-forest"><Edit size={15} /></button>}
                        {isAdmin && <button onClick={() => setDeleteId(t.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tenant Form Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Tenant' : 'Add Tenant'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Personal Info</h4></div>
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={form.full_name} onChange={f('full_name')} required />
            </div>
            <div>
              <label className="label">Phone (+234) *</label>
              <input className="input" value={form.phone} onChange={f('phone')} required placeholder="+2348012345678" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="label">NIN (optional)</label>
              <input className="input" value={form.nin} onChange={f('nin')} />
            </div>
            <div>
              <label className="label">Next of Kin Name</label>
              <input className="input" value={form.next_of_kin_name} onChange={f('next_of_kin_name')} />
            </div>
            <div>
              <label className="label">Next of Kin Phone</label>
              <input className="input" value={form.next_of_kin_phone} onChange={f('next_of_kin_phone')} />
            </div>

            <div className="col-span-2 pt-2"><h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tenancy Details</h4></div>
            <div>
              <label className="label">Property *</label>
              <select className="input" value={form.property_id} onChange={f('property_id')} required>
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit (optional)</label>
              <select className="input" value={form.unit_id} onChange={f('unit_id')} disabled={!form.property_id}>
                <option value="">Select unit…</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unit_number} - {u.status}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Rent Amount (₦) *</label>
              <input type="number" min="0" className="input" value={form.rent_amount} onChange={f('rent_amount')} required />
            </div>
            <div>
              <label className="label">Payment Frequency</label>
              <select className="input" value={form.payment_frequency} onChange={f('payment_frequency')}>
                {FREQ.map(f => <option key={f} value={f} className="capitalize">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tenancy Start *</label>
              <input type="date" className="input" value={form.tenancy_start} onChange={f('tenancy_start')} required />
            </div>
            <div>
              <label className="label">Tenancy End *</label>
              <input type="date" className="input" value={form.tenancy_end} onChange={f('tenancy_end')} required />
            </div>
            <div>
              <label className="label">Security Deposit (₦)</label>
              <input type="number" min="0" className="input" value={form.security_deposit} onChange={f('security_deposit')} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" value={form.notes} onChange={f('notes')} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : editItem ? 'Update Tenant' : 'Add Tenant'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Remove Tenant" message="This will permanently delete this tenant and their records."
      />
    </div>
  );
}
