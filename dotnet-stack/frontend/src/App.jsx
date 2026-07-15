import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import HotelDetailPage from './pages/HotelDetailPage';
import AdminBookingsPage from './pages/AdminBookingsPage';
import MyTripsPage from './pages/MyTripsPage';
import AuthPage from './pages/AuthPage';
import { ConciergePage, PortfolioPage, SustainabilityPage, AboutPage, ContactPage, NotFoundPage } from './pages/StaticPages';
import SiteFooter from './components/SiteFooter';

function ToastStack() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span>{t.kind === 'success' ? '✓' : t.kind === 'error' ? '⚠' : 'ℹ'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const offline = useStore((s) => s.offline);
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  // Reservations Desk is staff-only: admins when live, anyone in offline demo mode.
  const showDesk = user?.role === 'admin' || offline;
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}>
          ☰
        </button>
        <NavLink to="/" className="brand">
          <span className="brand-name">Wilderness Stays</span>
          <span className="brand-sub">Canadian Rustic Luxury</span>
        </NavLink>
        <nav className="topnav" aria-label="Primary">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/search">Find a Lodge</NavLink>
          <NavLink to="/trips">My Trips</NavLink>
          {showDesk && <NavLink to="/admin">Desk</NavLink>}
          <NavLink to="/about">About</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </nav>
        <div className="spacer" />
        <div className="status-pill" title={offline ? 'Backend unreachable — data saved to your browser' : 'Connected to live API'}>
          <span className={`status-dot ${offline ? 'offline' : 'live'}`} />
          <span className="pill-text">{offline ? 'Offline demo' : 'Live'}</span>
        </div>
        {user ? (
          <div className="user-chip" title={`${user.email} (${user.role})`}>
            <span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span className="pill-text">{user.name.split(' ')[0]}</span>
            <button className="linklike light" onClick={logout}>Sign out</button>
          </div>
        ) : (
          <button className="icon-btn" style={{ width: 'auto', padding: '0 14px', fontSize: '0.82rem', fontWeight: 600 }}
            onClick={() => navigate('/login', { state: { from: location.pathname } })}>
            Sign in
          </button>
        )}
      </header>

      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-head">
          <h2>Wilderness Stays</h2>
          <p>Wilderness Refined</p>
        </div>
        <nav>
          <NavLink to="/" end><span>🏔️</span> Home</NavLink>
          <NavLink to="/search"><span>🔍</span> Find a Lodge</NavLink>
          <NavLink to="/trips"><span>🎒</span> My Trips</NavLink>
          {showDesk && <NavLink to="/admin"><span>🗂️</span> Reservations Desk</NavLink>}
          <NavLink to="/concierge"><span>🛎️</span> Concierge</NavLink>
          <NavLink to="/portfolio"><span>🌲</span> Portfolio</NavLink>
          <NavLink to="/sustainability"><span>🍁</span> Sustainability</NavLink>
          <NavLink to="/about"><span>🌄</span> About Us</NavLink>
          <NavLink to="/contact"><span>✉️</span> Contact Us</NavLink>
        </nav>
        <div className="drawer-foot">
          {user ? `Signed in as ${user.name}` : 'Browsing as a visitor'}<br />
          Inspired by the Canadian Rockies — timber, stone & still water.
        </div>
      </aside>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<ExplorePage />} />
        <Route path="/hotel/:id" element={<HotelDetailPage />} />
        <Route path="/trips" element={<MyTripsPage />} />
        <Route path="/admin" element={<AdminBookingsPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/concierge" element={<ConciergePage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/sustainability" element={<SustainabilityPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <SiteFooter />

      <nav className="bottomnav">
        <NavLink to="/" end>
          <span className="nav-ico">🏔️</span> Home
        </NavLink>
        <NavLink to="/search">
          <span className="nav-ico">🔍</span> Search
        </NavLink>
        <NavLink to="/trips">
          <span className="nav-ico">🎒</span> My Trips
        </NavLink>
        {showDesk && (
          <NavLink to="/admin">
            <span className="nav-ico">🗂️</span> Desk
          </NavLink>
        )}
      </nav>

      <ToastStack />
    </>
  );
}
