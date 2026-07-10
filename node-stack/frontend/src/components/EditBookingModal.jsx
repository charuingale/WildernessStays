import React, { useState } from 'react';
import Modal from './Modal';
import { useStore } from '../store/useStore';

export default function EditBookingModal({ booking, onClose, allowStatus = false }) {
  const updateBooking = useStore((s) => s.updateBooking);
  const submitting = useStore((s) => s.submitting);
  const [form, setForm] = useState({
    guestName: booking.guestName,
    email: booking.email,
    phone: booking.phone || '',
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    guests: booking.guests,
    status: booking.status,
    specialRequests: booking.specialRequests || '',
  });
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!form.guestName.trim()) return setError('Guest name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) return setError('Enter a valid email');
    if (form.checkOut <= form.checkIn) return setError('Check-out must be after check-in');
    setError('');
    try {
      await updateBooking(booking.id, {
        guestName: form.guestName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: Number(form.guests),
        ...(allowStatus ? { status: form.status } : {}),
        specialRequests: form.specialRequests.trim() || undefined,
      });
      onClose();
    } catch { /* toast shown by store */ }
  };

  return (
    <Modal title={`Edit booking — ${booking.hotel?.name || ''}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          <div className="field full">
            <label>Guest name</label>
            <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Check-in</label>
            <input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </div>
          <div className="field">
            <label>Check-out</label>
            <input type="date" min={form.checkIn} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </div>
          <div className="field">
            <label>Guests</label>
            <input type="number" min="1" max="20" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} />
          </div>
          {allowStatus && (
            <div className="field full">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
          <div className="field full">
            <label>Special requests</label>
            <textarea rows="2" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} />
          </div>
        </div>
        {error && <p style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
