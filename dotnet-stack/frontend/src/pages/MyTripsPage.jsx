import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import EditBookingModal from '../components/EditBookingModal';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDate, formatMoney } from '../utils/dates';

export default function MyTripsPage() {
  const user = useStore((s) => s.user);
  const offline = useStore((s) => s.offline);
  const myBookings = useStore((s) => s.myBookings);
  const loading = useStore((s) => s.loadingMy);
  const loadMyBookings = useStore((s) => s.loadMyBookings);
  const updateBooking = useStore((s) => s.updateBooking);
  const deleteBooking = useStore((s) => s.deleteBooking);
  const navigate = useNavigate();

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadMyBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user && !offline && myBookings.length === 0 && !loading) {
    return (
      <main className="page">
        <div className="detail-title section">
          <div className="sub">Your private booking history</div>
          <h1>My Trips</h1>
        </div>
        <EmptyState icon="🔐" title="Sign in to see your trips">
          Your bookings are private to your account.{' '}
        </EmptyState>
        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('/login', { state: { from: '/trips' } })}>
            Sign in / Create account
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="detail-title section">
        <div className="sub">{user ? `Signed in as ${user.name}` : 'Local bookings on this device'}</div>
        <h1>My Trips</h1>
      </div>

      {offline && (
        <div className="offline-banner">
          <span>🍂</span>
          Offline demo mode — these bookings live in your browser's local storage.
        </div>
      )}

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading your trips" />
      ) : myBookings.length === 0 ? (
        <EmptyState icon="🎒" title="No trips yet">
          Find your next escape on the <Link to="/" style={{ color: 'var(--timber)', fontWeight: 600 }}>Explore page</Link>.
        </EmptyState>
      ) : (
        <div className="trip-list">
          {myBookings.map((b) => (
            <article key={b.id} className="trip-card">
              <div className="trip-img">
                <img src={b.hotel?.images?.[0]} alt="" loading="lazy" />
              </div>
              <div className="trip-body">
                <div className="trip-head">
                  <div>
                    <span className="place">{b.hotel ? `${b.hotel.place}, ${b.hotel.region}` : ''}</span>
                    <h3>{b.hotel?.name}</h3>
                  </div>
                  <span className={`status-badge ${b.status}`}>{b.status}</span>
                </div>
                <div className="trip-meta">
                  <span>📅 {formatDate(b.checkIn)} → {formatDate(b.checkOut)}</span>
                  <span>👤 {b.guests} guest{b.guests > 1 ? 's' : ''}</span>
                  <span>🛏️ {b.room?.name || 'Room'}</span>
                  <span className="trip-total">{formatMoney(b.totalPrice)}</span>
                </div>
                {b.specialRequests && <p className="trip-req">“{b.specialRequests}”</p>}
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(b)}>Edit</button>
                  {b.status !== 'cancelled' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => updateBooking(b.id, { status: 'cancelled' })}>
                      Cancel stay
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleting(b)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <EditBookingModal booking={editing} onClose={() => setEditing(null)} allowStatus={false} />}

      {deleting && (
        <Modal title="Delete this trip?" onClose={() => setDeleting(null)}>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.93rem' }}>
            Your stay at <strong>{deleting.hotel?.name}</strong> ({formatDate(deleting.checkIn)} –{' '}
            {formatDate(deleting.checkOut)}) will be permanently removed.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Keep it</button>
            <button className="btn btn-danger" onClick={async () => { await deleteBooking(deleting.id); setDeleting(null); }}>
              Delete trip
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
