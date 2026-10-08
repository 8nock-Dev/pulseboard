import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to request a reset link.');
    } finally { setLoading(false); }
  }

  return <AuthShell title="Forgot your password?" subtitle="Enter your account email and we’ll send a secure reset link.">
    {message ? <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3">{message}</div> :
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
        <div><label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
            className="w-full px-3.5 py-2.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900" /></div>
        <button disabled={loading} className="w-full py-2.5 bg-stone-900 text-white font-medium text-sm rounded-lg disabled:opacity-50">{loading ? 'Sending…' : 'Send reset link'}</button>
      </form>}
    <Link to="/login" className="block text-center text-sm text-stone-600 hover:underline mt-6">Back to sign in</Link>
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }) {
  return <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8"><div className="w-full max-w-sm">
    <div className="flex items-center gap-2 mb-10"><span className="text-xl">📡</span><span className="font-display font-bold text-lg">PulseBoard</span></div>
    <h1 className="font-display font-bold text-2xl text-stone-900 mb-1">{title}</h1><p className="text-stone-500 text-sm mb-8">{subtitle}</p>{children}
  </div></div>;
}
