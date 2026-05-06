import { useState, useEffect } from 'react';
import api, { formatCurrency } from '../utils/api';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  ArrowDownTrayIcon,
  DocumentChartBarIcon,
  CurrencyDollarIcon,
  HomeModernIcon,
  UsersIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const COLORS = ['#2d6a4f', '#52b788', '#d4a017', '#f4a261', '#e76f51'];

const StatCard = ({ icon: Icon, label, value, sub, color = 'primary' }) => (
  <div className="card flex items-start gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
      color === 'gold' ? 'bg-amber-100' : color === 'red' ? 'bg-red-100' : 'bg-primary-100'
    }`}>
      <Icon className={`w-5 h-5 ${
        color === 'gold' ? 'text-amber-600' : color === 'red' ? 'text-red-600' : 'text-primary-700'
      }`} />
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5" style={{ fontFamily: 'Sora, sans-serif' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports', { params: { start_date: dateRange.start, end_date: dateRange.end } });
      setReport(res.data);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const exportFile = async (format) => {
    setExporting(format);
    try {
      const res = await api.get(`/reports/export/${format}`, {
        params: { start_date: dateRange.start, end_date: dateRange.end },
        responseType: 'blob',
      });
      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `propms-report-${dateRange.start}-${dateRange.end}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting('');
    }
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="text-gray-400">Loading reports...</div>
    </div>
  );

  const summary = report?.summary || {};
  const monthly = report?.monthly_trend || [];
  const byProperty = report?.by_property || [];
  const occupancy = report?.occupancy || [];

  const occupancyPieData = [
    { name: 'Occupied', value: summary.occupied_units || 0 },
    { name: 'Vacant', value: summary.vacant_units || 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Financial & occupancy analytics</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input className="input text-sm" type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} />
          <span className="text-gray-400 text-sm">to</span>
          <input className="input text-sm" type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} />
          <button onClick={fetchReport} className="btn-secondary text-sm">Apply</button>
          <button
            onClick={() => exportFile('excel')}
            disabled={!!exporting}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exporting === 'excel' ? 'Exporting...' : 'Excel'}
          </button>
          <button
            onClick={() => exportFile('csv')}
            disabled={!!exporting}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exporting === 'csv' ? 'Exporting...' : 'CSV'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CurrencyDollarIcon} label="Total Rent Collected" value={formatCurrency(summary.total_collected || 0)} sub={`${summary.payment_count || 0} payments`} />
        <StatCard icon={ExclamationTriangleIcon} label="Outstanding Balance" value={formatCurrency(summary.total_outstanding || 0)} sub={`${summary.outstanding_count || 0} tenants`} color="red" />
        <StatCard icon={HomeModernIcon} label="Occupancy Rate" value={`${summary.occupancy_rate || 0}%`} sub={`${summary.occupied_units || 0} of ${summary.total_units || 0} units`} color="gold" />
        <StatCard icon={UsersIcon} label="Active Tenants" value={summary.active_tenants || 0} sub={`${summary.expiring_soon || 0} expiring soon`} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Monthly Revenue</h2>
          {monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Area type="monotone" dataKey="amount" stroke="#2d6a4f" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">No data for period</div>
          )}
        </div>

        {/* Occupancy Pie */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Occupancy Split</h2>
          {(summary.total_units || 0) > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={occupancyPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  <Cell fill="#2d6a4f" />
                  <Cell fill="#d4e8dd" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">No data</div>
          )}
          <div className="flex items-center justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary-700 inline-block" />Occupied</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary-100 inline-block" />Vacant</span>
          </div>
        </div>
      </div>

      {/* By Property Bar Chart */}
      {byProperty.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>Revenue by Property</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byProperty} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="property_name" type="category" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="total_amount" fill="#2d6a4f" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Occupancy Table */}
      {occupancy.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>Occupancy by Property</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Property</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Total Units</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Occupied</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Vacant</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Rate</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Monthly Rent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {occupancy.map(row => (
                  <tr key={row.property_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{row.property_name}</td>
                    <td className="px-5 py-3.5 text-gray-600">{row.total_units}</td>
                    <td className="px-5 py-3.5 text-gray-600">{row.occupied}</td>
                    <td className="px-5 py-3.5 text-gray-600">{row.vacant}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-24">
                          <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: `${row.occupancy_rate}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{row.occupancy_rate}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{formatCurrency(row.potential_rent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
