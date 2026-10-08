import { useState, useEffect } from 'react';

const INTERVALS = [
  { value: 1,  label: 'Every 1 minute' },
  { value: 5,  label: 'Every 5 minutes' },
  { value: 10, label: 'Every 10 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
];

const DEFAULT_FORM = {
  name: '',
  url: '',
  interval_minutes: 5,
  timeout_seconds: 10,
  expected_status_code: 200,
  notify_email: '',
  notify_webhook: '',
  public_visible: false,
  public_name: '',
};

export default function MonitorModal({ monitor, onSave, onClose }) {
  const [form, setForm]       = useState(DEFAULT_FORM);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab]         = useState('basic'); // 'basic' | 'alerts'

  const isEdit = Boolean(monitor);

  useEffect(() => {
    if (monitor) {
      setForm({
        name:                 monitor.name || '',
        url:                  monitor.url || '',
        interval_minutes:     monitor.interval_minutes || 5,
        timeout_seconds:      monitor.timeout_seconds || 10,
        expected_status_code: monitor.expected_status_code || 200,
        notify_email:         monitor.notify_email || '',
        notify_webhook:       monitor.notify_webhook || '',
        public_visible:       Boolean(monitor.public_visible),
        public_name:          monitor.public_name || '',
      });
    }
  }, [monitor]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.url.trim()) {
      errs.url = 'URL is required';
    } else {
      try { new URL(form.url); } catch { errs.url = 'Enter a valid URL (e.g. https://example.com)'; }
    }
    if (form.notify_webhook && !/^https?:\/\//.test(form.notify_webhook)) {
      errs.notify_webhook = 'Webhook must be a valid URL';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      await onSave({
        ...form,
        interval_minutes:     Number(form.interval_minutes),
        timeout_seconds:      Number(form.timeout_seconds),
        expected_status_code: Number(form.expected_status_code),
        notify_email:         form.notify_email.trim() || null,
        notify_webhook:       form.notify_webhook.trim() || null,
        public_name:          form.public_name.trim() || null,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-display font-bold text-lg text-stone-900">
            {isEdit ? 'Edit monitor' : 'Add monitor'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 px-6">
          {['basic', 'alerts'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-1 py-2.5 mr-5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
              }`}
            >
              {t === 'basic' ? 'Configuration' : 'Alerts'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">

            {/* ─── Basic Tab ─────────────────────────────── */}
            {tab === 'basic' && (
              <>
                <Field label="Display name" error={errors.name}>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Production API"
                    className={inputClass(errors.name)}
                  />
                </Field>

                <Field label="URL to monitor" error={errors.url}>
                  <input
                    name="url"
                    value={form.url}
                    onChange={handleChange}
                    placeholder="https://api.yourapp.com/health"
                    className={inputClass(errors.url)}
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    Must be publicly accessible. Use /health or /ping endpoints for best results.
                  </p>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Check interval">
                    <select
                      name="interval_minutes"
                      value={form.interval_minutes}
                      onChange={handleChange}
                      className={inputClass()}
                    >
                      {INTERVALS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Timeout (seconds)">
                    <input
                      type="number"
                      name="timeout_seconds"
                      value={form.timeout_seconds}
                      onChange={handleChange}
                      min={1}
                      max={30}
                      className={inputClass()}
                    />
                  </Field>
                </div>

                <Field label="Expected HTTP status code">
                  <input
                    type="number"
                    name="expected_status_code"
                    value={form.expected_status_code}
                    onChange={handleChange}
                    min={100}
                    max={599}
                    className={inputClass()}
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    Any response other than this code will trigger a DOWN alert.
                  </p>
                </Field>

                <label className="flex items-start gap-3 rounded-lg border border-stone-200 p-3">
                  <input
                    type="checkbox"
                    name="public_visible"
                    checked={form.public_visible}
                    onChange={handleChange}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-700">Show on public status page</span>
                    <span className="block text-xs text-stone-400">The target URL stays private.</span>
                  </span>
                </label>

                {form.public_visible && (
                  <Field label="Public service name">
                    <input
                      name="public_name"
                      value={form.public_name}
                      onChange={handleChange}
                      placeholder={form.name || 'Website'}
                      className={inputClass()}
                    />
                  </Field>
                )}
              </>
            )}

            {/* ─── Alerts Tab ────────────────────────────── */}
            {tab === 'alerts' && (
              <>
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-sm text-stone-500">
                  Alerts fire immediately when a monitor goes down, and again when it recovers.
                </div>

                <Field label="Email alerts" error={errors.notify_email}>
                  <input
                    type="email"
                    name="notify_email"
                    value={form.notify_email}
                    onChange={handleChange}
                    placeholder="alerts@yourcompany.com"
                    className={inputClass(errors.notify_email)}
                  />
                </Field>

                <Field label="Webhook URL (Slack, Discord, custom)" error={errors.notify_webhook}>
                  <input
                    type="url"
                    name="notify_webhook"
                    value={form.notify_webhook}
                    onChange={handleChange}
                    placeholder="https://hooks.slack.com/services/..."
                    className={inputClass(errors.notify_webhook)}
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    Slack incoming webhooks and Discord webhooks are supported.
                  </p>
                </Field>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function inputClass(hasError) {
  return `w-full px-3.5 py-2.5 border rounded-lg text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white transition ${
    hasError ? 'border-red-300' : 'border-stone-300'
  }`;
}
