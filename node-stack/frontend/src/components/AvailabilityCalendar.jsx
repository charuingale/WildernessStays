import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { todayISO } from '../utils/dates';

const DAY_MS = 86400000;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function monthStart(offset) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MonthGrid({ base, availability, checkIn, checkOut, hover, onDay, onHover }) {
  const today = todayISO();
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = base.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  // Preview range while choosing check-out
  const previewEnd = checkIn && !checkOut && hover && hover > checkIn ? hover : checkOut;

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(<span key={`pad-${i}`} className="cal-cell pad" />);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = iso(new Date(year, month, day));
    const info = availability.get(date);
    const past = date < today;
    const full = info != null && info.available === 0;
    const low = info != null && info.available > 0 && info.available < info.total;
    const isStart = date === checkIn;
    const isEnd = date === checkOut || (!checkOut && previewEnd === date);
    const inRange = checkIn && previewEnd && date > checkIn && date < previewEnd;
    const cls = [
      'cal-cell',
      past ? 'past' : full ? 'full' : low ? 'low' : 'open',
      isStart ? 'sel-start' : '',
      isEnd && previewEnd ? 'sel-end' : '',
      inRange ? 'in-range' : '',
    ].join(' ');
    cells.push(
      <button
        key={date}
        type="button"
        className={cls}
        disabled={past || (full && !isStart)}
        title={info != null ? `${date}: ${info.available === 0 ? 'fully booked' : `${info.available} of ${info.total} rooms free`}` : date}
        onClick={() => onDay(date)}
        onMouseEnter={() => onHover(date)}
      >
        {day}
      </button>,
    );
  }

  return (
    <div className="cal-month">
      <div className="cal-title">{label}</div>
      <div className="cal-week">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="cal-grid" onMouseLeave={() => onHover(null)}>{cells}</div>
    </div>
  );
}

/**
 * Two-month availability calendar. Click once to choose check-in,
 * click a later date to choose check-out.
 */
export default function AvailabilityCalendar({ hotel, room, checkIn, checkOut, onRange }) {
  const loadCalendar = useStore((s) => s.loadCalendar);
  const localBookings = useStore((s) => s.localBookings);
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null);
  const [pendingIn, setPendingIn] = useState(null);

  const m0 = useMemo(() => monthStart(offset), [offset]);
  const m1 = useMemo(() => monthStart(offset + 1), [offset]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const start = iso(m0) < todayISO() ? todayISO() : iso(m0);
    const end = new Date(m1.getFullYear(), m1.getMonth() + 1, 1);
    const span = Math.ceil((end.getTime() - Date.parse(start)) / DAY_MS);
    loadCalendar(hotel, start, span, room?.id).then((data) => {
      if (!alive) return;
      setDays(data || []);
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel.id, room?.id, offset, localBookings]);

  const availability = useMemo(
    () => new Map(days.map((d) => [d.date, { available: d.available, total: d.total ?? 1 }])),
    [days],
  );

  const selIn = pendingIn ?? checkIn;
  const selOut = pendingIn ? null : checkOut;

  const handleDay = (date) => {
    if (!pendingIn) {
      setPendingIn(date);
    } else if (date > pendingIn) {
      onRange(pendingIn, date);
      setPendingIn(null);
    } else {
      setPendingIn(date);
    }
  };

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <button type="button" className="icon-btn cal-nav" aria-label="Earlier" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))}>‹</button>
        <span className="cal-hint">
          {room ? `${room.name} — ` : 'All rooms — '}
          {pendingIn ? 'now pick your check-out date' : 'pick a check-in date'}
        </span>
        <button type="button" className="icon-btn cal-nav" aria-label="Later" disabled={offset >= 10} onClick={() => setOffset((o) => o + 1)}>›</button>
      </div>
      {loading ? (
        <div className="spinner" style={{ margin: '30px auto' }} role="status" aria-label="Loading availability" />
      ) : (
        <div className="cal-months">
          <MonthGrid base={m0} availability={availability} checkIn={selIn} checkOut={selOut} hover={hover} onDay={handleDay} onHover={setHover} />
          <MonthGrid base={m1} availability={availability} checkIn={selIn} checkOut={selOut} hover={hover} onDay={handleDay} onHover={setHover} />
        </div>
      )}
      <div className="cal-legend">
        <span><i className="dot open" /> All rooms free</span>
        <span><i className="dot low" /> Some rooms booked</span>
        <span><i className="dot full" /> Fully booked</span>
        <span><i className="dot sel" /> Your stay</span>
      </div>
    </div>
  );
}
