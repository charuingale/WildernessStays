import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { todayISO, formatMoney, formatDate } from '../utils/dates';

const DESTINATIONS = ['Banff', 'Lake Louise', 'Jasper', 'Whistler', 'Tofino', 'Canmore', 'Mont-Tremblant', 'Anywhere'];
const BUDGETS = [
  { label: 'Under $350', min: '', max: 350 },
  { label: '$350 – $500', min: 350, max: 500 },
  { label: '$500+', min: 500, max: '' },
  { label: 'Surprise me', min: '', max: '' },
];

/** Next Friday→Sunday from today. */
function weekendRange() {
  const now = new Date();
  const day = now.getDay();
  const toFriday = ((5 - day) + 7) % 7 || 7;
  const fri = new Date(now.getTime() + toFriday * 86400000);
  const sun = new Date(fri.getTime() + 2 * 86400000);
  return [fri.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

/**
 * Trail Guide — a guided concierge that walks users through the same criteria
 * as the search filters (destination, dates, guests, budget), then applies
 * them to the shared store and presents the matching lodges.
 */
export default function TrailGuideChat() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('dest'); // dest -> dates -> guests -> budget -> results
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Hi, I'm your Trail Guide 🏔️ Tell me what you're dreaming of and I'll match you with a lodge. Where would you like to go?" },
  ]);
  const [destText, setDestText] = useState('');
  const [dates, setDates] = useState({ checkIn: todayISO(1), checkOut: todayISO(3) });
  const [answers, setAnswers] = useState({ place: '', guests: 2, minPrice: '', maxPrice: '' });
  const [results, setResults] = useState(null); // null = not searched, [] = none
  const [searching, setSearching] = useState(false);
  const threadRef = useRef(null);
  const navigate = useNavigate();
  const setFilters = useStore((s) => s.setFilters);
  const loadHotels = useStore((s) => s.loadHotels);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, searching, results, open]);

  const say = (from, text) => setMessages((m) => [...m, { from, text }]);

  const chooseDestination = (place) => {
    const label = place || 'Anywhere';
    say('user', label);
    setAnswers((a) => ({ ...a, place: place === 'Anywhere' ? '' : place }));
    say('bot', 'Great choice. When are you thinking of escaping?');
    setStep('dates');
  };

  const chooseDates = (checkIn, checkOut, label) => {
    say('user', label || `${formatDate(checkIn)} → ${formatDate(checkOut)}`);
    setDates({ checkIn, checkOut });
    say('bot', 'And how many of you are heading into the wild?');
    setStep('guests');
  };

  const chooseGuests = (guests) => {
    say('user', `${guests} guest${guests > 1 ? 's' : ''}`);
    setAnswers((a) => ({ ...a, guests }));
    if (guests >= 5) say('bot', "Good news — every lodge has a family room that sleeps six. What's your budget per night?");
    else say('bot', "Almost there — what's your budget per night?");
    setStep('budget');
  };

  const chooseBudget = async (b) => {
    say('user', b.label);
    const next = { ...answers, minPrice: b.min, maxPrice: b.max };
    setAnswers(next);
    setStep('results');
    setSearching(true);
    say('bot', 'One moment — checking live availability for you…');

    // Apply the exact same filters the search page uses, then read the results.
    setFilters({
      place: next.place,
      minPrice: b.min,
      maxPrice: b.max,
      availableOnly: true,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
    });
    await loadHotels();
    const hotels = useStore.getState().hotels;
    setSearching(false);
    setResults(hotels.slice(0, 3));
    say('bot', hotels.length === 0
      ? "Hmm — nothing matches all of that. Try widening the budget or shifting dates, or browse everything and see what calls to you."
      : `Found ${hotels.length} lodge${hotels.length > 1 ? 's' : ''} for your dates — here ${hotels.length > 1 ? 'are my top picks' : 'it is'}:`);
  };

  const restart = () => {
    setStep('dest');
    setResults(null);
    setDestText('');
    setMessages([{ from: 'bot', text: 'Fresh start! Where would you like to go?' }]);
  };

  return (
    <>
      <button
        className={`chatbot-fab ${open ? 'open' : ''}`}
        aria-label={open ? 'Close Trail Guide' : 'Open Trail Guide — find your lodge'}
        onClick={() => setOpen(!open)}
      >
        {open ? '✕' : '🧭'}
        {!open && <span className="fab-label">Find my lodge</span>}
      </button>

      {open && (
        <section className="chatbot-panel" aria-label="Trail Guide lodge finder">
          <header className="chatbot-head">
            <span className="chatbot-avatar">🧭</span>
            <div>
              <strong>Trail Guide</strong>
              <p>Your lodge-finding concierge</p>
            </div>
          </header>

          <div className="chat-thread" ref={threadRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
            ))}
            {searching && <div className="chat-msg bot typing"><span /><span /><span /></div>}

            {step === 'results' && !searching && results && results.length > 0 && (
              <div className="chat-results">
                {results.map((h) => (
                  <Link key={h.id} to={`/hotel/${h.id}`} className="chat-card" onClick={() => setOpen(false)}>
                    <img src={h.images[0]} alt="" loading="lazy" />
                    <div>
                      <strong>{h.name}</strong>
                      <span>{h.place}, {h.region}</span>
                      <em>from {formatMoney(h.pricePerNight)}/night · {h.roomsAvailable} room{h.roomsAvailable > 1 ? 's' : ''} free</em>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="chat-input-area">
            {step === 'dest' && (
              <>
                <div className="chat-chips">
                  {DESTINATIONS.map((d) => (
                    <button key={d} className="chip" onClick={() => chooseDestination(d)}>{d}</button>
                  ))}
                </div>
                <form
                  className="chat-textrow"
                  onSubmit={(e) => { e.preventDefault(); if (destText.trim()) chooseDestination(destText.trim()); }}
                >
                  <input
                    value={destText}
                    onChange={(e) => setDestText(e.target.value)}
                    placeholder="…or type a place"
                    aria-label="Type a destination"
                  />
                  <button type="submit" className="btn btn-primary btn-sm">Go</button>
                </form>
              </>
            )}

            {step === 'dates' && (
              <>
                <div className="chat-chips">
                  <button className="chip" onClick={() => { const [ci, co] = weekendRange(); chooseDates(ci, co, 'This weekend'); }}>
                    This weekend
                  </button>
                  <button className="chip" onClick={() => chooseDates(todayISO(7), todayISO(10), 'Next week, 3 nights')}>
                    Next week · 3 nights
                  </button>
                </div>
                <div className="chat-dates">
                  <input type="date" aria-label="Check-in" min={todayISO()} value={dates.checkIn}
                    onChange={(e) => setDates((d) => ({ ...d, checkIn: e.target.value }))} />
                  <span>→</span>
                  <input type="date" aria-label="Check-out" min={dates.checkIn} value={dates.checkOut}
                    onChange={(e) => setDates((d) => ({ ...d, checkOut: e.target.value }))} />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn}
                    onClick={() => chooseDates(dates.checkIn, dates.checkOut)}
                  >
                    Set
                  </button>
                </div>
              </>
            )}

            {step === 'guests' && (
              <div className="chat-chips">
                {[1, 2, 4, 6].map((g) => (
                  <button key={g} className="chip" onClick={() => chooseGuests(g)}>{g} guest{g > 1 ? 's' : ''}</button>
                ))}
              </div>
            )}

            {step === 'budget' && (
              <div className="chat-chips">
                {BUDGETS.map((b) => (
                  <button key={b.label} className="chip" onClick={() => chooseBudget(b)}>{b.label}</button>
                ))}
              </div>
            )}

            {step === 'results' && !searching && (
              <div className="chat-chips">
                <button className="chip chip-primary" onClick={() => { setOpen(false); navigate('/search'); }}>
                  See all matches
                </button>
                <button className="chip" onClick={restart}>Start over</button>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
