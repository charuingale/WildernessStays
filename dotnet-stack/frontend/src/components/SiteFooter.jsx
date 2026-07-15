import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

export default function SiteFooter() {
  const user = useStore((s) => s.user);
  const register = useStore((s) => s.register);
  const authBusy = useStore((s) => s.authBusy);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const eMap = {};
    if (form.name.trim().length < 2) eMap.name = 'Please enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) eMap.email = 'Enter a valid email';
    if (form.password.length < 6) eMap.password = 'At least 6 characters';
    setErrors(eMap);
    if (Object.keys(eMap).length) return;
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      setForm({ name: '', email: '', password: '' });
    } catch { /* toast shown by store */ }
  };

  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <h3>Wilderness Stays</h3>
          <p className="footer-tag">Canadian Rustic Luxury — timber, stone &amp; still water.</p>
          <address>
            212 Bow Valley Trail, Suite 400<br />
            Canmore, Alberta T1W 1N2, Canada
          </address>
          <p className="footer-contact">
            <a href="tel:+18005550164">1-800-555-0164</a><br />
            <a href="mailto:stay@wildernessstays.ca">stay@wildernessstays.ca</a><br />
            Daily, 7 am – 10 pm MT
          </p>
        </div>

        <nav className="footer-links" aria-label="Quick links">
          <h4>Quick links</h4>
          <Link to="/search">Our Hotels</Link>
          <Link to="/trips">My Trips</Link>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact Us</Link>
          <Link to="/concierge">Concierge</Link>
          <Link to="/sustainability">Sustainability</Link>
        </nav>

        <div className="footer-signup">
          {user ? (
            <>
              <h4>Welcome back, {user.name.split(' ')[0]}</h4>
              <p className="footer-tag">You're signed in and ready to book.</p>
              <Link to="/search" className="btn btn-timber" style={{ marginTop: 10 }}>Find your lodge</Link>
            </>
          ) : (
            <>
              <h4>Join Wilderness Stays</h4>
              <p className="footer-tag">Create a free account to book stays and manage your trips.</p>
              <form onSubmit={submit} noValidate>
                <div className="field">
                  <input aria-label="Name" placeholder="Your name" value={form.name}
                    className={errors.name ? 'invalid' : ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  {errors.name && <span className="err">{errors.name}</span>}
                </div>
                <div className="field">
                  <input aria-label="Email" type="email" placeholder="you@example.com" value={form.email}
                    className={errors.email ? 'invalid' : ''}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  {errors.email && <span className="err">{errors.email}</span>}
                </div>
                <div className="field">
                  <input aria-label="Password" type="password" placeholder="Choose a password" value={form.password}
                    className={errors.password ? 'invalid' : ''}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  {errors.password && <span className="err">{errors.password}</span>}
                </div>
                <button type="submit" className="btn btn-timber" disabled={authBusy} style={{ width: '100%' }}>
                  {authBusy ? 'Creating account…' : 'Sign up free'}
                </button>
              </form>
              <p className="footer-fineprint">
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
      <div className="footer-base">
        © 2026 Wilderness Stays · Crafted in the Canadian Rockies 🍁
      </div>
    </footer>
  );
}
