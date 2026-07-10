import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import EditBookingModal from '../components/EditBookingModal';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { bookingsToCsv, downloadCsv } from '../utils/csv';
import { formatDate, formatMoney, todayISO } from '../utils/dates';

export default function AdminBookingsPage() {
  const bookings = useStore((s) => s.bookings);
  const loading = useStore((s) => s.loadingBookings);
  const offline = useStore((s) => s.offline);
  const loadBookings = useStore((s) => s.loadBookings);
  const deleteBooking = useStore((s) => s.deleteBooking);
  const search = useStore((s) => s.bookingSearch);
  const setSearch = useStore((s) => s.setBookingSearch);
  const status = useStore((s) => s.bookingStatus);
  const setStatus = useStore((s) => s.setBookingStatus);
  const user = useStore((s) => s.user);
  const navigate = useNavigate();

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const isAdmin = user?.role === 'admin';
  const gated = !offline && !isAdmin;

  useEffect(() => {
    if (gated) return undefined;
    const t = setTimeout(() => loadBookings(), search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, gated]);

  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'cancelled');
    return {
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      revenue: active.reduce((sum, b) => sum + Number(b.totalPrice), 0),
    };
  }, [bookings]);

  const exportCsv = async () => {
    if (!offline) {
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const res = await fetch(`/api/bookings/export/csv?${params.toString()}`);
        if (res.ok) {
          downloadCsv(await res.text(), `bookings-${todayISO()}.csv`);
          return;
        }
      } catch { /* fall through to client-side export */ }
    }
    downloadCsv(bookingsToCsv(bookings), `bookings-${todayISO()}.csv`);
  };

  return (
    <main className="page">
      <div className="detail-title section">
        <div className="sub">Reservations desk</div>
        <h1>Bookings</h1>
      </div>

      {gated && (
        <>
          <EmptyState icon="🔐" title={user ? 'Admin access required' : 'Reservations Desk is for staff'}>
            {user
              ? `You're signed in as ${user.name} (guest). Sign in with an admin account to manage all bookings.`
              : 'Sign in with the admin account to view and manage every booking.'}
          </EmptyState>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <button className="btn btn-primary" onClick={() => navigate('/login', { state: { from: '/admin' } })}>
              Sign in
            </button>
            <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--slate)' }}>
              Demo admin — admin@wilderness.ca / admin123
            </p>
          </div>
        </>
      )}

      {!gated && (
        <>

      {offline && (
        <div className="offline-banner">
          <span>🍂</span>
          Offline demo mode — bookings shown below are stored in your browser's local storage.
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="s-value">{stats.total}</div>
          <div className="s-label">Total bookings</div>
        </div>
        <div className="stat-card alt">
          <div className="s-value">{stats.confirmed}</div>
          <div className="s-label">Confirmed</div>
        </div>
        <div className="stat-card alt">
          <div className="s-value">{stats.pending}</div>
          <div className="s-label">Pending</div>
        </div>
        <div className="stat-card alt">
          <div className="s-value">{formatMoney(stats.revenue)}</div>
          <div className="s-label">Active revenue</div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="field">
          <label htmlFor="a-search">Search</label>
          <input
            id="a-search"
            type="search"
            placeholder="Guest, email, hotel, place…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="a-status">Status</label>
          <select id="a-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button className="btn btn-timber" onClick={exportCsv} disabled={bookings.length === 0}>
          ⬇ Export CSV
        </button>
      </div>

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading bookings" />
      ) : bookings.length === 0 ? (
        <EmptyState icon="🗂️" title="No bookings found">
          {search || status
            ? 'Try clearing the search or status filter.'
            : 'Reservations made from the Explore page will appear here.'}
        </EmptyState>
      ) : (
        <div className="booking-table-wrap">
          <table className="booking-table">
            <thead>
              <tr>
                <th>Hotel</th>
                <th>Guest</th>
                <th>Stay</th>
                <th>Guests</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="b-hotel">{b.hotel?.name}</div>
                    <div className="b-sub">
                      {b.room?.name ? `${b.room.name} · ` : ''}
                      {b.hotel ? `${b.hotel.place}, ${b.hotel.region}` : ''}
                    </div>
                  </td>
                  <td>
                    <div className="b-hotel">{b.guestName}</div>
                    <div className="b-sub">{b.email}</div>
                  </td>
                  <td>
                    <div>{formatDate(b.checkIn)} →</div>
                    <div>{formatDate(b.checkOut)}</div>
                  </td>
                  <td>{b.guests}</td>
                  <td><strong>{formatMoney(b.totalPrice)}</strong></td>
                  <td><span className={`status-badge ${b.status}`}>{b.status}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(b)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleting(b)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

        </>
      )}

      {editing && <EditBookingModal booking={editing} onClose={() => setEditing(null)} allowStatus />}

      {deleting && (
        <Modal title="Delete this booking?" onClose={() => setDeleting(null)}>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.93rem' }}>
            {deleting.guestName}'s stay at <strong>{deleting.hotel?.name}</strong> (
            {formatDate(deleting.checkIn)} – {formatDate(deleting.checkOut)}) will be permanently
            removed and the rooms released.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Keep it</button>
            <button
              className="btn btn-danger"
              onClick={async () => { await deleteBooking(deleting.id); setDeleting(null); }}
            >
              Delete booking
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
