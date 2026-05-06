import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, MapPin, Users, Home, Edit, Trash2, Eye } from 'lucide-react';
import API, { formatCurrency } from '../utils/api';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const PROPERTY_TYPES = ['residential', 'commercial', 'mixed', 'industrial'];
const STATES = ['Lagos', 'FCT', 'Rivers', 'Kano', 'Oyo', 'Kaduna', 'Anambra', 'Delta', 'Ogun', 'Edo', 'Enugu', 'Imo', 'Cross River', 'Kwara', 'Plateau'];

const initForm = { name: '', address: '', city: '', state: 'Lagos', property_type: 'residential', total_units: 1, description: '', amenities: '' };

export default function PropertiesPage() {
  const { canEdit, isAdmin } = useAuth();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/properties', { params: { search } });
      setProperties(data.properties);
    } catch { toast.error('Failed to load properties'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const openCreate = () => { setForm(initForm); setEditItem(null); setShowModal(true); };
  const openEdit = (p) => {
    setForm({ ...p, amenities: (p.amenities || []).join(', ') });
    setEditItem(p);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amenities: form.amenities ? form.amenities.split(',').map(a => a.trim()).filter(Boolean) : [] };
      if (editItem) {
        await API.put(`/properties/${editItem.id}`, payload);
        toast.success('Property updated');
      } else {
        await API.post('/properties', payload);
        toast.success('Property created');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/properties/${deleteId}`);
      toast.success('Property deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Properties</h1>
          <p className="text-gray-500 text-sm">{properties.length} properties managed</p>
        </div>
        {canEdit && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Property</button>}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search properties…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-forest/20 border-t-forest rounded-full animate-spin" /></div>
      ) : properties.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No properties found</p>
          {canEdit && <button onClick={openCreate} className="btn-primary mx-auto mt-4"><Plus size={16} /> Add your first property</button>}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map((p) => {
            const occ = parseInt(p.total_units) > 0 ? Math.round((parseInt(p.occupied_units) / parseInt(p.total_units)) * 100) : 0;
            return (
              <div key={p.id} className="card group hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-active capitalize">{p.property_type}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base truncate">{p.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <MapPin size={12} />
                      <span className="truncate">{p.city || p.state}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/properties/${p.id}`} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-forest"><Eye size={15} /></Link>
                    {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-forest"><Edit size={15} /></button>}
                    {isAdmin && <button onClick={() => setDeleteId(p.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="font-bold text-gray-900">{p.total_units}</div>
                    <div className="text-xs text-gray-500">Units</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="font-bold text-green-700">{p.occupied_units || 0}</div>
                    <div className="text-xs text-gray-500">Occupied</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="font-bold text-gray-700">{p.vacant_units || 0}</div>
                    <div className="text-xs text-gray-500">Vacant</div>
                  </div>
                </div>

                {/* Occupancy bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Occupancy</span><span>{occ}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-forest transition-all" style={{ width: `${occ}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Users size={14} />
                    <span>{p.active_tenants || 0} tenants</span>
                  </div>
                  <Link to={`/properties/${p.id}`} className="text-sm text-forest font-medium hover:underline flex items-center gap-1">
                    View details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Property' : 'Add Property'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Property Name *</label>
              <input className="input" value={form.name} onChange={f('name')} required placeholder="e.g. Lekki Phase 1 Complex" />
            </div>
            <div className="col-span-2">
              <label className="label">Address *</label>
              <input className="input" value={form.address} onChange={f('address')} required placeholder="Full address" />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={f('city')} placeholder="Lagos" />
            </div>
            <div>
              <label className="label">State</label>
              <select className="input" value={form.state} onChange={f('state')}>
                {STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Property Type</label>
              <select className="input" value={form.property_type} onChange={f('property_type')}>
                {PROPERTY_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total Units *</label>
              <input type="number" min="1" className="input" value={form.total_units} onChange={f('total_units')} required />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={form.description} onChange={f('description')} placeholder="Brief description..." />
            </div>
            <div className="col-span-2">
              <label className="label">Amenities (comma-separated)</label>
              <input className="input" value={form.amenities} onChange={f('amenities')} placeholder="Security, Generator, Water, CCTV" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : editItem ? 'Update Property' : 'Create Property'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Property"
        message="This will permanently delete the property and all its units. Active tenants must be removed first."
      />
    </div>
  );
}
