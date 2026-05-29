import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Login() {
  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload  = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res = await api.post(endpoint, payload);
      login(res.data.token, res.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-stone-900 p-12">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📡</span>
            <span className="text-white font-display font-bold text-xl">PulseBoard</span>
          </div>
        </div>

        <div>
          <blockquote className="text-stone-300 text-lg leading-relaxed font-light mb-8">
            "Know before your users do. Monitor every endpoint, API, and service — 
            get alerted the moment something goes wrong."
          </blockquote>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Monitors', value: '∞' },
              { label: 'Check interval', value: '1m' },
              { label: 'Alert delay', value: '< 60s' },
            ].map(({ label, value }) => (
              <div key={label} className="border border-stone-700 rounded-lg p-4">
                <p className="text-stone-500 text-xs uppercase tracking-wider">{label}</p>
                <p className="text-white font-display font-bold text-2xl mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-stone-600 text-xs">
          Self-hostable · Open Source · No limits
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <span className="text-xl">📡</span>
            <span className="font-display font-bold text-lg text-stone-900">PulseBoard</span>
          </div>

          <h1 className="font-display font-bold text-2xl text-stone-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-stone-500 text-sm mb-8">
            {mode === 'login'
              ? 'Sign in to your monitoring dashboard'
              : 'Start monitoring your services for free'}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Alex Johnson"
                  required
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white transition"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-stone-900 text-white font-medium text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="text-center text-sm text-stone-500 mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-stone-900 font-medium hover:underline"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
