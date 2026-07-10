import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const authBusy = useStore((s) => s.authBusy);
  const offline = useStore((s) => s.offline);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from || '/';

  const submit = async (e) => {
    e.preventDefault();
    const eMap = {};
    if (mode === 'register' && form.name.trim().length < 2) eMap.name = 'Please enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) eMap.email = 'Enter a valid email';
    if (form.password.length < 6) eMap.password = 'At least 6 characters';
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    try {
      if (mode === 'login') await login(form.email.trim(), form.password);
      else await register(form.name.trim(), form.email.trim(), form.password);
      navigate(returnTo);
    } catch { /* toast shown by store */ }
  };

  return (
    <main className="page">
      <div className="auth-card">
        <div className="detail-title" style={{ marginBottom: 18 }}>
          <div className="sub">{mode === 'login' ? 'Welcome back' : 'Join us'}</div>
          <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
        </div>

        {offline && (
          <div className="offline-banner">
            <span>🍂</span>
            The API is unreachable, so sign-in is unavailable — but the offline demo works
            without an account (bookings save to your browser).
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            {mode === 'register' && (
              <div className="field full">
                <label htmlFor="au-name">Name</label>
                <input id="au-name" value={form.name} placeholder="Your full name"
                  className={errors.name ? 'invalid' : ''}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
                {errors.name && <span className="err">{errors.name}</span>}
              </div>
            )}
            <div className="field full">
              <label htmlFor="au-email">Email</label>
              <input id="au-email" type="email" value={form.email} placeholder="you@example.com"
                className={errors.email ? 'invalid' : ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email && <span className="err">{errors.email}</span>}
            </div>
            <div className="field full">
              <label htmlFor="au-pass">Password</label>
              <input id="au-pass" type="password" value={form.password} placeholder="••••••••"
                className={errors.password ? 'invalid' : ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {errors.password && <span className="err">{errors.password}</span>}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={authBusy}>
            {authBusy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>New to Wilderness Stays?{' '}
              <button className="linklike" onClick={() => { setMode('register'); setErrors({}); }}>Create an account</button></>
          ) : (
            <>Already have an account?{' '}
              <button className="linklike" onClick={() => { setMode('login'); setErrors({}); }}>Sign in</button></>
          )}
        </p>

        <div className="demo-creds">
          <strong>Demo accounts</strong>
          <span>Guest — guest@example.com / guest123</span>
          <span>Admin — admin@wilderness.ca / admin123</span>
        </div>
      </div>
    </main>
  );
}
