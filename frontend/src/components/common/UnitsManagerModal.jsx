import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, CheckCircle, AlertCircle, MinusCircle } from 'lucide-react';
import API, { formatCurrency } from '../../utils/api';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const UNIT_TYPES = ['apartment', 'flat', 'studio', 'duplex', 'bungalow', 'shop', 'office', 'warehouse'];
const STATUS_OPTIONS = ['vacant', 'occupied', 'maintenance'];

const STATUS_CONFIG = {
  vacant:      { icon: CheckCircle,  cls: 'text-green-600',  bg: 'bg-green-50',  badge: 'badge-active',   label: 'Vacant' },
  occupied:    { icon: MinusCircle,  cls: 'text-amber-600',  bg: 'bg-amber-50',  badge: 'badge-warning',  label: 'Occupied' },
  maintenance: { icon: AlertCircle, cls: 'text-red-500',    bg: 'bg-red-50',    badge: 'badge-expired',  label: 'Maintenance' },
};

const initForm = {
  unit_number: '', unit_type: 'apartment', bedrooms: 1, bathrooms: 1, size_sqm: '', rent_amount: '', status: 'vacant',
};

export default function UnitsManagerModal({ isOpen, onClose, property }) {
  const { canEdit, isAdmin } = useAuth();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleteUnitId, setDeleteUnitId] = useState(null);

  const loadUnits = useCallback(async () => {
    if (!property?.id) return;
    setLoading(true);
    try {
      const { data } = await API.get(`/properties/${property.id}/units`);
      setUnits(data.units || []);
    } catch {
      toast.error('Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [property?.id]);

  useEffect(() => {
    if (isOpen) loadUnits();
  }, [isOpen, loadUnits]);

  const openCreate = () => {
    setForm(initForm);
    setEditUnit(null);
    setShowForm(true);
  };

  const openEdit = (u) => {
    setForm({
      unit_number: u.unit_number,
      unit_type: u.unit_type || 'apartment',
      bedrooms: u.bedrooms || 1,
      bathrooms: u.bathrooms || 1,
      size_sqm: u.size_sqm || '',
      rent_amount: u.rent_amount || '',
      status: u.status || 'vacant',
    });
    setEditUnit(u);
    setShowForm(true);
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.unit_number.trim()) { toast.error('Unit number is required'); return; }
    if (!form.rent_amount || parseFloat(form.rent_amount) <= 0) { toast.error('Rent amount is required'); return; }
    setSaving(true);
    try {
      if (editUnit) {
        await API.put(`/properties/${property.id}/units/${editUnit.id}`, form);
        toast.success('Unit updated');
      } else {
        await API.post(`/properties/${property.id}/units`, form);
        toast.success('Unit added');
      }
      setShowForm(false);
      loadUnits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/properties/${property.id}/units/${deleteUnitId}`);
      toast.success('Unit removed');
      setDeleteUnitId(null);
      loadUnits();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const occupied = units.filter(u => u.status === 'occupied').length;
  const vacant = units.filter(u => u.status === 'vacant').length;
  const maintenance = units.filter(u => u.status === 'maintenance').length;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <span>Manage Units</span>
            {property && (
              <span className="text-sm font-normal text-gray-500">— {property.name}</span>
            )}
          </span>
        }
        size="xl"
      >
        {/* Summary bar */}
        {units.length > 0 && (
          <div className="flex gap-3 mb-5 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="text-gray-600">{vacant} Vacant</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="text-gray-600">{occupied} Occupied</span>
            </div>
            {maintenance > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span className="text-gray-600">{maintenance} Maintenance</span>
              </div>
            )}
            <div className="ml-auto text-sm text-gray-500">{units.length} total</div>
          </div>
        )}

        {/* Add unit inline form */}
        {showForm && (
          <div className="border border-primary-200 bg-primary-50/40 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800 text-sm">
                {editUnit ? 'Edit Unit' : 'New Unit'}
              </h4>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Unit No. *</label>
                  <input className="input" value={form.unit_number} onChange={f('unit_number')} placeholder="A1, 101…" required />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.unit_type} onChange={f('unit_type')}>
                    {UNIT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Rent (₦) *</label>
                  <input type="number" min="1" className="input" value={form.rent_amount} onChange={f('rent_amount')} placeholder="500000" required />
                </div>
                <div>
                  <label className="label">Bedrooms</label>
                  <select className="input" value={form.bedrooms} onChange={f('bedrooms')}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} bed{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Bathrooms</label>
                  <select className="input" value={form.bathrooms} onChange={f('bathrooms')}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n} bath{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Size (m²)</label>
                  <input type="number" min="0" className="input" value={form.size_sqm} onChange={f('size_sqm')} placeholder="Optional" />
                </div>
                {editUnit && (
                  <div>
                    <label className="label">Status</label>
                    <select className="input" value={form.status} onChange={f('status')}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3 justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm py-1.5 px-3">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm py-1.5 px-4">
                  {saving ? 'Saving…' : editUnit ? 'Update Unit' : 'Add Unit'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Units table */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-forest/20 border-t-forest rounded-full animate-spin" />
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Plus size={20} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No units yet — add your first unit below</p>
            {canEdit && !showForm && (
              <button onClick={openCreate} className="btn-primary mx-auto mt-4 text-sm">
                <Plus size={14} /> Add Unit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['Unit No.', 'Type', 'Beds / Bath', 'Rent', 'Size', 'Status', 'Tenant', ''].map((h, i) => (
                    <th key={i} className={`px-3 py-2.5 text-left text-white font-medium bg-forest text-xs
                      ${i === 0 ? 'rounded-tl-lg' : ''}
                      ${i === 7 ? 'rounded-tr-lg' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.map((u) => {
                  const sc = STATUS_CONFIG[u.status] || STATUS_CONFIG.vacant;
                  const Icon = sc.icon;
                  return (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="px-3 py-2.5 font-mono font-medium text-gray-900">{u.unit_number}</td>
                      <td className="px-3 py-2.5 text-gray-600 capitalize">{u.unit_type || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{u.bedrooms}bd / {u.bathrooms}ba</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{formatCurrency(u.rent_amount)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{u.size_sqm ? `${u.size_sqm} m²` : '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${sc.cls}`}>
                          <Icon size={12} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">
                        {u.tenant_name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {canEdit && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-forest"
                              title="Edit unit"
                            >
                              <Pencil size={13} />
                            </button>
                            {isAdmin && u.status !== 'occupied' && (
                              <button
                                onClick={() => setDeleteUnitId(u.id)}
                                className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600"
                                title="Delete unit"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          {canEdit && !showForm && (
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus size={14} /> Add Unit
            </button>
          )}
          <button onClick={onClose} className="btn-secondary text-sm ml-auto">
            Done
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteUnitId}
        onClose={() => setDeleteUnitId(null)}
        onConfirm={handleDelete}
        title="Delete Unit"
        message="This will permanently remove this unit. Tenants assigned to it will not be deleted but their unit link will be cleared."
        danger
      />
    </>
  );
}
