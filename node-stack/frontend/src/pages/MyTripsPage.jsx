import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import EditBookingModal from '../components/EditBookingModal';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { formatDate, formatMoney } from '../utils/dates';
import { CANCEL_POLICY } from '../utils/policy';

function CancelStayModal({ booking, onClose }) {
  const getCancellationQuote = useStore((s) => s.getCancellationQuote);
  const cancelBooking = useStore((s) => s.cancelBooking);
  const submitting = useStore((s) => s.submitting);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getCancellationQuote(booking.id)
      .then((q) => { if (alive) { setQuote(q); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  const confirm = async () => {
    try {
      await cancelBooking(booking.id);
      onClose();
    } catch { /* toast shown by store */ }
  };

  return (
    <Modal title={`Cancel your stay at ${booking.hotel?.name}?`} onClose={onClose}>
      {loading ? (
        <div className="spinner" role="status" aria-label="Checking the cancellation policy" />
      ) : !quote ? (
        <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Couldn't load the cancellation policy — try again.</p>
      ) : !quote.cancellable ? (
        <>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.93rem' }}>{quote.reason}</p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>Got it</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 14 }}>
            {quote.feePercent === 0
              ? `You're outside the ${CANCEL_POLICY.freeUntilDaysBefore}-day window (check-in in ${quote.daysUntilCheckIn} days), so cancellation is free.`
              : `Check-in is only ${quote.daysUntilCheckIn} day${quote.daysUntilCheckIn > 1 ? 's' : ''} away — within ${CANCEL_POLICY.freeUntilDaysBefore} days of check-in a ${quote.feePercent}% cancellation fee applies.`}
          </p>
          <div className="quote-box">
            <div className="quote-row"><span>Booking total</span><span>{formatMoney(booking.totalPrice)}</span></div>
            <div className="quote-row fee"><span>Cancellation fee ({quote.feePercent}%)</span><span>−{formatMoney(quote.fee)}</span></div>
            <div className="quote-row refund"><span>Your refund</span><span>{formatMoney(quote.refund)}</span></div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Keep my booking</button>
            <button className="btn btn-danger" onClick={confirm} disabled={submitting}>
              {submitting ? 'Cancelling…' : `Cancel & refund ${formatMoney(quote.refund)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function MyTripsPage() {
  const user = useStore((s) => s.user);
  const offline = useStore((s) => s.offline);
  const myBookings = useStore((s) => s.myBookings);
  const loading = useStore((s) => s.loadingMy);
  const loadMyBookings = useStore((s) => s.loadMyBookings);
  const deleteBooking = useStore((s) => s.deleteBooking);
  const navigate = useNavigate();

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [cancelling, setCancelling] = useState(null);

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
          Find your next escape on the <Link to="/search" style={{ color: 'var(--timber)', fontWeight: 600 }}>Search page</Link>.
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
                {b.status === 'cancelled' && b.refundAmount != null && (
                  <p className="refund-note">
                    ↩ {formatMoney(b.refundAmount)} refunded
                    {Number(b.cancellationFee) > 0 ? ` · ${formatMoney(b.cancellationFee)} cancellation fee` : ' · no fee'}
                    {b.cancelledAt ? ` · ${formatDate(String(b.cancelledAt).slice(0, 10))}` : ''}
                  </p>
                )}
                {b.specialRequests && <p className="trip-req">“{b.specialRequests}”</p>}
                <div className="row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(b)}>Edit</button>
                  {b.status !== 'cancelled' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setCancelling(b)}>
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

      {cancelling && <CancelStayModal booking={cancelling} onClose={() => setCancelling(null)} />}

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
