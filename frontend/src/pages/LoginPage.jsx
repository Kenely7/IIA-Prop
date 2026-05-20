import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(form.email, form.password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #40916C 100%)' }}>
      {/* Left branding */}
      <div className="hidden lg:flex flex-col justify-center items-center flex-1 p-12 text-white">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Home size={28} className="text-white" />
            </div>
            <span className="font-display font-bold text-4xl">PropMS</span>
          </div>
          <h2 className="font-display text-3xl font-bold mb-4 leading-tight">
            Property Management<br />Made Simple
          </h2>
          <p className="text-green-200 text-lg leading-relaxed mb-8">
            Manage your properties, tenants, payments, and reminders from one powerful dashboard built for Nigerian real estate.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {['Track Rentals', 'Auto Reminders', 'PDF Receipts', 'Excel Reports'].map((f) => (
              <div key={f} className="bg-white/10 rounded-xl p-3 text-sm font-medium">✓ {f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-forest flex items-center justify-center">
              <Home size={20} className="text-white" />
            </div>
            <span className="font-display font-bold text-forest text-2xl">PropMS</span>
          </div>

          <h1 className="font-display font-bold text-2xl text-gray-900 mb-2">Sign in</h1>
          <p className="text-gray-500 text-sm mb-8">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className="input pl-9"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="admin@propms.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  value={form.password}
                  onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-forest text-white py-3 rounded-xl font-semibold hover:bg-forest-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            PropMS — Property Management System for Nigerian Real Estate
          </p>
        </div>
      </div>
    </div>
  );
}
