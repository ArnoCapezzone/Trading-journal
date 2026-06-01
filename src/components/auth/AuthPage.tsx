import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const { signIn, signUp, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registered, setRegistered] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border-default)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (mode === 'login') {
      await signIn(email, password);
    } else {
      await signUp(email, password);
      setRegistered(true);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-app)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52,
            backgroundColor: '#3D8EF0',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: 'var(--text-on-accent)',
            margin: '0 auto 16px',
            fontFamily: '"JetBrains Mono", monospace',
          }}>TJ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Trading Journal</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          padding: '32px 28px',
        }}>
          {registered && mode === 'register' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>📧</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#00C47A', marginBottom: 8 }}>Check your email</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                Click it to activate your account, then sign in.
              </div>
              <button
                onClick={() => { setMode('login'); setRegistered(false); }}
                style={{ marginTop: 20, padding: '9px 20px', backgroundColor: '#3D8EF0', border: 'none', borderRadius: 6, color: 'var(--text-on-accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#3D8EF0')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#3D8EF0')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-default)')}
                />
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255,77,77,0.1)',
                  border: '1px solid rgba(255,77,77,0.3)',
                  borderRadius: 6,
                  color: '#F04848',
                  fontSize: 13,
                  marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '11px',
                  backgroundColor: isLoading ? 'var(--bg-surface-2)' : '#3D8EF0',
                  border: 'none',
                  borderRadius: 6,
                  color: isLoading ? 'var(--text-tertiary)' : 'var(--bg-app)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                {isLoading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        {/* Toggle mode */}
        {!registered && (
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
            {mode === 'login' ? (
              <>No account yet?{' '}
                <button onClick={() => { setMode('register'); clearError(); }} style={{ background: 'none', border: 'none', color: '#3D8EF0', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                  Create one
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); clearError(); }} style={{ background: 'none', border: 'none', color: '#3D8EF0', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text-tertiary)' }}>
          Your data is synced across all your devices via Supabase
        </div>
      </div>
    </div>
  );
}
