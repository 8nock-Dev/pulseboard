import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-lg">📡</span>
          <span className="font-display font-bold text-stone-900 text-base">PulseBoard</span>
        </Link>

        {/* Nav */}
        <div className="flex items-center gap-6">
          {user && (
            <>
              <Link
                to={`/status/${user.status_slug}`}
                target="_blank"
                className="text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5"
              >
                <span>Status page</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>

              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-500 hidden sm:block">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
