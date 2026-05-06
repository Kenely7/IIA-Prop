import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Building2, Users, CreditCard, TrendingUp, AlertTriangle, Clock, ArrowRight, Home } from 'lucide-react';
import API, { formatCurrency, formatDate } from '../utils/api';
import toast from 'react-hot-toast';

const StatCard = ({ icon: Icon, label, value, sub, color = 'forest', trend }) => (
  <div className="card">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center`}
        style={{ background: color === 'forest' ? '#1B4332' : color === 'blue' ? '#1e40af' : color === 'amber' ? '#d97706' : '#dc2626', opacity: 0.1 }}>
        <Icon size={20} style={{ color: color === 'forest' ? '#1B4332' : color === 'blue' ? '#1e40af' : color === 'amber' ? '#d97706' : '#dc2626' }} />
      </div>
      {trend != null && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="font-display font-bold text-2xl text-gray-900">{value}</div>
    <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-lg shadow-lg p-3 text-sm">
        <p className="text-gray-500 mb-1">{label}</p>
        <p className="font-semibold text-forest">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: res } = await API.get('/dashboard');
        setData(res.dashboard);
      } catch (err) {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-forest/20 border-t-forest rounded-full animate-spin" />
    </div>
  );

  const { properties, tenants, payments, occupancy_rate, expiring_tenancies, outstanding_balances, monthly_trend } = data || {};
  const totalUnits = parseInt(properties?.total_units) || 0;
  const occupiedUnits = parseInt(properties?.occupied_units) || 0;
  const vacantUnits = parseInt(properties?.vacant_units) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}</p>
        </div>
        <Link to="/payments" className="btn-primary text-sm">
          <CreditCard size={16} /> Record Payment
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Properties" value={properties?.total_properties || 0} sub={`${totalUnits} total units`} color="forest" />
        <StatCard icon={Users} label="Active Tenants" value={tenants?.active_tenants || 0} sub={`${tenants?.expired_tenants || 0} expired`} color="blue" />
        <StatCard icon={Home} label="Occupancy Rate" value={`${occupancy_rate || 0}%`} sub={`${occupiedUnits} occupied / ${vacantUnits} vacant`} color="amber" />
        <StatCard icon={TrendingUp} label="Revenue (This Month)" value={formatCurrency(payments?.total_rent_this_month)} sub={`YTD: ${formatCurrency(payments?.total_rent_ytd)}`} color="forest" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly revenue chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend (Last 6 Months)</h3>
          {monthly_trend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly_trend}>
                <defs>
                  <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B4332" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1B4332" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="total" stroke="#1B4332" strokeWidth={2.5} fill="url(#green)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No payment data yet</div>
          )}
        </div>

        {/* Occupancy donut */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Unit Status</h3>
          <div className="space-y-3 mt-6">
            {[
              { label: 'Occupied', value: occupiedUnits, color: '#1B4332', bg: '#e8f5e9' },
              { label: 'Vacant', value: vacantUnits, color: '#6B7280', bg: '#f3f4f6' },
              { label: 'Maintenance', value: parseInt(properties?.maintenance_units) || 0, color: '#d97706', bg: '#fef3c7' },
            ].map(({ label, value, color, bg }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-semibold" style={{ color }}>{value}</span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ background: bg }}>
                  <div className="h-2.5 rounded-full" style={{ background: color, width: `${totalUnits ? (value / totalUnits) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <span className="text-3xl font-display font-bold" style={{ color: '#1B4332' }}>{occupancy_rate}%</span>
            <p className="text-xs text-gray-500 mt-1">Occupancy Rate</p>
          </div>
        </div>
      </div>

      {/* Alerts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Expiring tenancies */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              <h3 className="font-semibold text-gray-900">Expiring Soon</h3>
            </div>
            <Link to="/tenants?expiring=true" className="text-sm text-forest hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {expiring_tenancies?.length > 0 ? (
            <div className="space-y-2">
              {expiring_tenancies.map((t) => (
                <Link key={t.id} to={`/tenants/${t.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{t.full_name}</div>
                    <div className="text-xs text-gray-500">{t.property_name} {t.unit_number ? `· ${t.unit_number}` : ''}</div>
                  </div>
                  <div className={`text-right`}>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.days_remaining <= 7 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {t.days_remaining}d left
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(t.tenancy_end)}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-6">No tenancies expiring in the next 30 days</p>}
        </div>

        {/* Outstanding balances */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600" />
              <h3 className="font-semibold text-gray-900">Outstanding Balances</h3>
            </div>
            <Link to="/tenants?outstanding=true" className="text-sm text-forest hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {outstanding_balances?.length > 0 ? (
            <div className="space-y-2">
              {outstanding_balances.map((t) => (
                <Link key={t.id} to={`/tenants/${t.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{t.full_name}</div>
                    <div className="text-xs text-gray-500">{t.property_name}</div>
                  </div>
                  <div className="font-semibold text-red-600 text-sm">{formatCurrency(t.outstanding)}</div>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-6">No outstanding balances 🎉</p>}
        </div>
      </div>
    </div>
  );
}
