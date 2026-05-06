import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import {
  UserCircleIcon,
  PlusIcon,
  KeyIcon,
  ShieldCheckIcon,
  UserIcon,
  EyeIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';

const ROLE_CONFIG = {
  admin: { label: 'Admin', cls: 'badge-danger', icon: ShieldCheckIcon },
  manager: { label: 'Manager', cls: 'badge-warning', icon: UserIcon },
  viewer: { label: 'Viewer', cls: 'badge-default', icon: EyeIcon },
};

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [activeTab, setActiveTab] = useState('account');

  const [userForm, setUserForm] = useState({ full_name: '', email: '', password: '', role: 'manager' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) fetchUsers();
    else setLoading(false);
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.users || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!userForm.full_name || !userForm.email || !userForm.password) {
      toast.error('All fields required');
      return;
    }
    if (userForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/register', userForm);
      toast.success('User created successfully');
      setShowUserModal(false);
      setUserForm({ full_name: '', email: '', password: '', role: 'manager' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const changePassword = async () => {
    if (!pwForm.current_password || !pwForm.new_password) {
      toast.error('All fields required');
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await api.put('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'My Account' },
    ...(isAdmin ? [{ id: 'users', label: 'User Management' }] : []),
    { id: 'system', label: 'System Info' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Sora, sans-serif' }}>Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and system configuration</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="max-w-lg space-y-4">
          <div className="card flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
              <UserCircleIcon className="w-8 h-8 text-primary-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{user?.full_name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className={`badge mt-1 ${ROLE_CONFIG[user?.role]?.cls || 'badge-default'}`}>
                {ROLE_CONFIG[user?.role]?.label || user?.role}
              </span>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900">Account Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Full Name</p>
                <p className="font-medium text-gray-900 mt-0.5">{user?.full_name}</p>
              </div>
              <div>
                <p className="text-gray-500">Email Address</p>
                <p className="font-medium text-gray-900 mt-0.5">{user?.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Role</p>
                <p className="font-medium text-gray-900 mt-0.5 capitalize">{user?.role}</p>
              </div>
              <div>
                <p className="text-gray-500">Account Status</p>
                <p className="font-medium text-green-600 mt-0.5 flex items-center gap-1">
                  <CheckBadgeIcon className="w-4 h-4" /> Active
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn-secondary flex items-center gap-2 w-full justify-center"
          >
            <KeyIcon className="w-4 h-4" />
            Change Password
          </button>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{users.length} users in system</p>
            <button onClick={() => setShowUserModal(true)} className="btn-primary flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Add User
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading users...</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map(u => {
                  const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer;
                  const Icon = rc.icon;
                  return (
                    <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{u.full_name}</p>
                        <p className="text-sm text-gray-500">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`badge ${rc.cls}`}>{rc.label}</span>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="max-w-lg space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">System Configuration</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Application', value: 'PropMS — Nigerian Property Manager' },
                { label: 'Version', value: '1.0.0' },
                { label: 'Backend', value: 'Node.js + Express' },
                { label: 'Database', value: 'PostgreSQL' },
                { label: 'SMS Provider', value: 'Termii (Africa\'s Talking fallback)' },
                { label: 'Email Provider', value: 'SMTP (Nodemailer)' },
                { label: 'Currency', value: 'Nigerian Naira (₦ NGN)' },
                { label: 'Timezone', value: 'Africa/Lagos (WAT, UTC+1)' },
                { label: 'Cron Schedule', value: 'Daily 07:00 WAT' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500 flex-shrink-0">{label}</span>
                  <span className="font-medium text-gray-900 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card bg-primary-50 border border-primary-100">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-primary-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary-900 text-sm">Security Note</p>
                <p className="text-xs text-primary-700 mt-1">
                  JWT tokens expire after 7 days. Passwords are bcrypt-hashed. All API endpoints are protected by role-based access control.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="Add New User" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input w-full" value={userForm.full_name} onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input w-full" type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" />
          </div>
          <div>
            <label className="label">Password *</label>
            <input className="input w-full" type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input w-full" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowUserModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={createUser} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Current Password *</label>
            <input className="input w-full" type="password" value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
          </div>
          <div>
            <label className="label">New Password *</label>
            <input className="input w-full" type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Confirm New Password *</label>
            <input className="input w-full" type="password" value={pwForm.confirm_password} onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowPasswordModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={changePassword} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
