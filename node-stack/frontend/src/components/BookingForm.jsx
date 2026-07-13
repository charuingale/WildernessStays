import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { todayISO, nightsBetween, formatMoney, formatDate } from '../utils/dates';
import { freeCancellationUntil, CANCEL_POLICY } from '../utils/policy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;

export default function BookingForm({ hotel, room, onBooked, range }) {
  const filters = useStore((s) => s.filters);
  const createBooking = useStore((s) => s.createBooking);
  const submitting = useStore((s) => s.submitting);
  const user = useStore((s) => s.user);
  const offline = useStore((s) => s.offline);
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    guestName: user?.name || '',
    email: user?.email || '',
    phone: '',
    checkIn: filters.checkIn || todayISO(1),
    checkOut: filters.checkOut || todayISO(3),
    guests: 2,
    specialRequests: '',
  });
  const [errors, setErrors] = useState({});

  /* Keep dates in sync with the availability calendar selection. */
  useEffect(() => {
    if (range?.checkIn && range?.checkOut) {
      setForm((f) => ({ ...f, checkIn: range.checkIn, checkOut: range.checkOut }));
    }
  }, [range?.checkIn, range?.checkOut]);

  /* Prefill contact details once the user signs in. */
  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        guestName: f.guestName || user.name,
        email: f.email || user.email,
      }));
    }
  }, [user]);
  const [touched, setTouched] = useState({});

  const nights = useMemo(() => {
    const n = nightsBetween(form.checkIn, form.checkOut);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [form.checkIn, form.checkOut]);

  const rate = room ? room.pricePerNight : hotel.pricePerNight;
  const total = nights * rate;

  const validate = (f = form) => {
    const e = {};
    if (!f.guestName.trim() || f.guestName.trim().length < 2) e.guestName = 'Please enter the guest name';
    if (!EMAIL_RE.test(f.email)) e.email = 'Enter a valid email address';
    if (f.phone && !PHONE_RE.test(f.phone)) e.phone = 'Enter a valid phone number';
    if (!f.checkIn) e.checkIn = 'Required';
    else if (f.checkIn < todayISO()) e.checkIn = 'Check-in cannot be in the past';
    if (!f.checkOut) e.checkOut = 'Required';
    else if (f.checkOut <= f.checkIn) e.checkOut = 'Must be after check-in';
    if (f.guests < 1 || f.guests > 20) e.guests = '1–20 guests';
    else if (room && f.guests > room.capacity) e.guests = `${room.name} sleeps up to ${room.capacity}`;
    return e;
  };

  const set = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched[key]) setErrors(validate(next));
  };

  const blur = (key) => {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validate());
  };

  const submit = async (e) => {
    e.preventDefault();
    const eMap = validate();
    setErrors(eMap);
    setTouched({ guestName: true, email: true, phone: true, checkIn: true, checkOut: true, guests: true });
    if (Object.keys(eMap).length) return;
    try {
      const booking = await createBooking({
        hotelId: hotel.id,
        roomId: room.id,
        guestName: form.guestName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guests: Number(form.guests),
        specialRequests: form.specialRequests.trim() || undefined,
      });
      onBooked?.(booking);
    } catch {
      /* toast already shown by the store */
    }
  };

  const field = (key) => ({
    className: touched[key] && errors[key] ? 'invalid' : '',
    onBlur: () => blur(key),
  });

  const soldOut = hotel.roomsAvailable === 0;
  const noRoom = !room;
  const needsLogin = !offline && !user;

  if (needsLogin) {
    return (
      <div className="login-gate">
        <p>Sign in to reserve — your bookings stay private to your account.</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => navigate('/login', { state: { from: location.pathname } })}
        >
          Sign in / Create account
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="b-name">Guest name *</label>
          <input id="b-name" type="text" placeholder="Full name" value={form.guestName}
            onChange={(e) => set('guestName', e.target.value)} {...field('guestName')} />
          {touched.guestName && errors.guestName && <span className="err">{errors.guestName}</span>}
        </div>
        <div className="field full">
          <label htmlFor="b-email">Email *</label>
          <input id="b-email" type="email" placeholder="you@example.com" value={form.email}
            onChange={(e) => set('email', e.target.value)} {...field('email')} />
          {touched.email && errors.email && <span className="err">{errors.email}</span>}
        </div>
        <div className="field full">
          <label htmlFor="b-phone">Phone (optional)</label>
          <input id="b-phone" type="tel" placeholder="+1 403 555 0100" value={form.phone}
            onChange={(e) => set('phone', e.target.value)} {...field('phone')} />
          {touched.phone && errors.phone && <span className="err">{errors.phone}</span>}
        </div>
        <div className="field">
          <label htmlFor="b-in">Check-in *</label>
          <input id="b-in" type="date" min={todayISO()} value={form.checkIn}
            onChange={(e) => set('checkIn', e.target.value)} {...field('checkIn')} />
          {touched.checkIn && errors.checkIn && <span className="err">{errors.checkIn}</span>}
        </div>
        <div className="field">
          <label htmlFor="b-out">Check-out *</label>
          <input id="b-out" type="date" min={form.checkIn || todayISO(1)} value={form.checkOut}
            onChange={(e) => set('checkOut', e.target.value)} {...field('checkOut')} />
          {touched.checkOut && errors.checkOut && <span className="err">{errors.checkOut}</span>}
        </div>
        <div className="field full">
          <label htmlFor="b-guests">Guests *</label>
          <input id="b-guests" type="number" min="1" max="20" value={form.guests}
            onChange={(e) => set('guests', Number(e.target.value))} {...field('guests')} />
          {touched.guests && errors.guests && <span className="err">{errors.guests}</span>}
        </div>
        <div className="field full">
          <label htmlFor="b-req">Special requests</label>
          <textarea id="b-req" rows="2" placeholder="Late arrival, dietary needs, celebrations…"
            value={form.specialRequests} onChange={(e) => set('specialRequests', e.target.value)} />
        </div>
      </div>

      <div className="total-row">
        <span className="t-label">
          {nights > 0 && room
            ? `${formatMoney(rate)} × ${nights} night${nights > 1 ? 's' : ''} — ${room.name}`
            : nights > 0
              ? 'Choose a room to see your total'
              : 'Select your dates'}
        </span>
        <span className="t-value">{nights > 0 && room ? formatMoney(total) : '—'}</span>
      </div>

      {nights > 0 && (
        <p className="policy-note">
          Free cancellation until <strong>{formatDate(freeCancellationUntil(form.checkIn))}</strong>.
          Within {CANCEL_POLICY.freeUntilDaysBefore} days of check-in, a {CANCEL_POLICY.lateFeePercent}% fee applies.
        </p>
      )}

      <button type="submit" className="btn btn-timber" style={{ width: '100%' }} disabled={submitting || soldOut || noRoom}>
        {soldOut
          ? 'Fully booked for these dates'
          : noRoom
            ? 'Choose a room above to reserve'
            : submitting
              ? 'Confirming…'
              : `Reserve ${room.name}`}
      </button>
    </form>
  );
}
