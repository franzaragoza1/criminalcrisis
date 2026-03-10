import { useState } from 'react';
import { api } from '../../api';

interface Props {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await api.login(username, password);
      localStorage.setItem('cc_token', token);
      onLogin();
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-[#111] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          CRIMINAL CRISIS
        </h1>
        <p className="text-sm text-[#888] mb-8">Admin Panel</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-wide uppercase text-[#888] mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-[#E0E0E0] px-4 py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-wide uppercase text-[#888] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#E0E0E0] px-4 py-3 text-sm text-[#111] focus:outline-none focus:border-[#111] transition-colors"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#111] text-[#FAFAFA] py-3 text-sm font-semibold tracking-wide hover:bg-[#333] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-[#888] mt-6 text-center">
          <a href="/" className="hover:text-[#111] transition-colors">← Back to site</a>
        </p>
      </div>
    </div>
  );
}
