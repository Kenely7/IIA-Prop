import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Building2, Home, Plus } from 'lucide-react';
import API, { formatCurrency, formatDate } from '../utils/api';
import toast from 'react-hot-toast';

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await API.get(`/properties/${id}`);
        setProperty(data.property);
        setUnits(data.units);
        setTenants(data.tenants);
      } catch { toast.error('Failed to load property'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-forest/20 border-t-forest rounded-full animate-spin" /></div>;
  if (!property) return <div className="card text-center py-16"><p>Property not found</p></div>;

  const occ = property.total_units > 0 ? Math.round((property.occupied_units / property.total_units) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/properties" className="btn-secondary !py-2"><ArrowLeft size={16} /> Back</Link>
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">{property.name}</h1>
          <div className="flex items-center gap-1 text-gray-500 text-sm"><MapPin size={14} />{property.address}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Units', value: property.total_units, icon: Building2, color: '#1B4332' },
          { label: 'Occupied', value: property.occupied_units || 0, icon: Home, color: '#16a34a' },
          { label: 'Vacant', value: property.vacant_units || 0, icon: Home, color: '#6B7280' },
          { label: 'Occupancy', value: `${occ}%`, icon: Users, color: '#d97706' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card text-center">
            <div className="font-display font-bold text-2xl" style={{ color }}>{value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Property info */}
      <div className="card">
        <h3 className="font-semibold mb-4">Property Details</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Type: </span><span className="capitalize font-medium">{property.property_type}</span></div>
          <div><span className="text-gray-500">City: </span><span className="font-medium">{property.city || '—'}</span></div>
          <div><span className="text-gray-500">State: </span><span className="font-medium">{property.state || '—'}</span></div>
          {property.description && <div className="md:col-span-2"><span className="text-gray-500">Description: </span><span>{property.description}</span></div>}
          {property.amenities?.length > 0 && (
            <div className="md:col-span-2">
              <span className="text-gray-500">Amenities: </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {property.amenities.map(a => <span key={a} className="badge-active">{a}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tenants table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Tenants ({tenants.length})</h3>
          <Link to={`/tenants?property_id=${id}`} className="text-sm text-forest hover:underline">View all →</Link>
        </div>
        {tenants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No tenants for this property</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2.5 font-medium text-white bg-forest rounded-l-lg">Tenant</th>
                  <th className="px-3 py-2.5 font-medium text-white bg-forest">Unit</th>
                  <th className="px-3 py-2.5 font-medium text-white bg-forest">Rent/yr</th>
                  <th className="px-3 py-2.5 font-medium text-white bg-forest">End Date</th>
                  <th className="px-3 py-2.5 font-medium text-white bg-forest rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <Link to={`/tenants/${t.id}`} className="font-medium text-forest hover:underline">{t.full_name}</Link>
                      <div className="text-xs text-gray-400">{t.phone}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{t.unit_number || '—'}</td>
                    <td className="px-3 py-3 font-medium">{formatCurrency(t.rent_amount)}</td>
                    <td className="px-3 py-3 text-gray-600">{formatDate(t.tenancy_end)}</td>
                    <td className="px-3 py-3">
                      <span className={t.status === 'active' ? 'badge-active' : 'badge-expired'}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Units */}
      {units.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Units ({units.length})</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map((u) => (
              <div key={u.id} className={`rounded-lg p-3 border ${u.status === 'occupied' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{u.unit_number}</div>
                    <div className="text-xs text-gray-500 capitalize">{u.unit_type} · {u.bedrooms}bed/{u.bathrooms}bath</div>
                  </div>
                  <span className={u.status === 'occupied' ? 'badge-active' : u.status === 'maintenance' ? 'badge-warning' : 'badge-vacant'}>{u.status}</span>
                </div>
                <div className="font-semibold text-sm text-forest mt-2">{formatCurrency(u.rent_amount)}</div>
                {u.tenant_name && <div className="text-xs text-gray-500 mt-0.5">→ {u.tenant_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
