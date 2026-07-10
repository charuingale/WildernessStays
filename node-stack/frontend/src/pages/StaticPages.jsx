import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

function StaticPage({ kicker, title, lead, cards }) {
  return (
    <main className="page static-page">
      <div className="detail-title section">
        <div className="sub">{kicker}</div>
        <h1>{title}</h1>
      </div>
      <p className="lead">{lead}</p>
      {cards.map((c) => (
        <div key={c.title} className="static-card">
          <h3>{c.icon} {c.title}</h3>
          <p>{c.body}</p>
        </div>
      ))}
    </main>
  );
}

export const ConciergePage = () => (
  <StaticPage
    kicker="At your service"
    title="Concierge"
    lead="Our concierge team designs each stay around the wilderness outside your window — from heli-hiking at dawn to a private chef beside the lake."
    cards={[
      { icon: '🥾', title: 'Guided expeditions', body: 'Certified mountain guides for glacier walks, larch-season hikes, and backcountry ski tours, tailored to your pace.' },
      { icon: '🍽️', title: 'Private dining', body: 'Chef-led tasting menus in-suite, on the dock, or beside a mountaintop fire — sourced from Alberta and BC producers.' },
      { icon: '🛶', title: 'Lake & river', body: 'Canoe crossings at first light, fly-fishing with local outfitters, and storm-watching packages on the Pacific coast.' },
      { icon: '🚁', title: 'Arrivals', body: 'Heli-transfers, private car service from Calgary and Vancouver, and ski-valet handling from door to gondola.' },
    ]}
  />
);

export const PortfolioPage = () => (
  <StaticPage
    kicker="Our lodges"
    title="Portfolio"
    lead="Eight independent lodges across Alberta, British Columbia and Québec — each rooted in its landscape, each unmistakably Wilderness Stays."
    cards={[
      { icon: '🏔️', title: 'The Rockies Collection', body: 'Emerald Pines Lodge, Lakeshore Timber Retreat, Glacier Vista Chalet, Aurora Ridge Cabins, and Boreal Sky Resort.' },
      { icon: '🌊', title: 'The Coast Collection', body: 'Cedar & Stone Resort in Whistler and Pacific Mist Lodge on Tofino’s storm-swept Cox Bay.' },
      { icon: '🍁', title: 'The Laurentians', body: 'Laurentian Hearth Manoir brings Québécois warmth — stone hearths, maple interiors, and lakeside mornings.' },
    ]}
  />
);

export const SustainabilityPage = () => (
  <StaticPage
    kicker="Light on the land"
    title="Sustainability"
    lead="Luxury that leaves the wilderness as it found it. Every lodge operates under our Light-on-the-Land charter."
    cards={[
      { icon: '☀️', title: 'Renewable power', body: 'Solar arrays and micro-hydro supply the majority of lodge energy; Boreal Sky Resort runs fully off-grid.' },
      { icon: '🌲', title: 'Timber stewardship', body: 'All construction timber is FSC-certified or reclaimed; one hectare of boreal forest is protected for every stay.' },
      { icon: '🦌', title: 'Wildlife-first design', body: 'Dark-sky lighting, wildlife corridors kept clear of trails, and seasonal closures during calving and denning.' },
      { icon: '🥕', title: 'Alpine larder', body: 'Menus built on a 250 km sourcing radius, zero-waste kitchens, and partnerships with Indigenous producers.' },
    ]}
  />
);

export const AboutPage = () => (
  <StaticPage
    kicker="Who we are"
    title="About Wilderness Stays"
    lead="Wilderness Stays is a collection of eight independent lodges across Alberta, British Columbia and Québec — a booking platform built for travellers who want the Canadian wild with the comforts of considered design. Browse lodges, compare individually crafted rooms, check live availability on the calendar, and reserve in minutes; every room is one of a kind, so once it's booked for your dates, it's yours alone."
    cards={[
      { icon: '🏔️', title: 'Rooted in place', body: 'Each lodge is shaped by its landscape — glacier lakes at Lake Louise, storm-swept surf at Tofino, dark skies over Jasper. No two properties, and no two rooms, are alike.' },
      { icon: '🛏️', title: 'Real rooms, real availability', body: 'Every room you see is a specific, physical space with its own view, capacity and character. The availability calendar reflects live bookings, so what you see is what you can reserve.' },
      { icon: '🤝', title: 'Book with confidence', body: 'Secure accounts keep your trips private, reservations confirm instantly, and cancellations free the room for fellow travellers right away.' },
      { icon: '🍁', title: 'Proudly Canadian', body: 'Founded in Canmore in 2019 by a small team of guides, hoteliers and designers who believe luxury should sit lightly on the land.' },
    ]}
  />
);

export function ContactPage() {
  const toast = useStore((s) => s.toast);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email) || !form.message.trim()) {
      toast('Please fill in your name, a valid email, and a message', 'error');
      return;
    }
    toast("Message sent — our concierge team will reply within one business day", 'success');
    setForm({ name: '', email: '', message: '' });
  };

  return (
    <main className="page static-page">
      <div className="detail-title section">
        <div className="sub">We'd love to hear from you</div>
        <h1>Contact Us</h1>
      </div>
      <p className="lead">
        Questions about a lodge, a reservation, or planning something special?
        Reach us any way you like — a real person answers.
      </p>

      <div className="contact-grid">
        <div>
          <div className="static-card">
            <h3>🏠 Head Office</h3>
            <p>
              Wilderness Stays Inc.<br />
              212 Bow Valley Trail, Suite 400<br />
              Canmore, Alberta T1W 1N2<br />
              Canada
            </p>
          </div>
          <div className="static-card">
            <h3>📞 Reservations & Concierge</h3>
            <p>
              Toll-free: 1-800-555-0164<br />
              Local: +1 (403) 555-0148<br />
              Daily, 7 am – 10 pm MT
            </p>
          </div>
          <div className="static-card">
            <h3>✉️ Email</h3>
            <p>
              Reservations — stay@wildernessstays.ca<br />
              Concierge — concierge@wildernessstays.ca<br />
              Press & partnerships — hello@wildernessstays.ca
            </p>
          </div>
          <div className="static-card">
            <h3>🗺️ Regional desks</h3>
            <p>
              Whistler, BC — 4293 Mountain Square, Unit 210<br />
              Mont-Tremblant, QC — 116 Chemin de Kandahar
            </p>
          </div>
        </div>

        <form className="static-card contact-form" onSubmit={submit}>
          <h3>📨 Send us a note</h3>
          <div className="field">
            <label htmlFor="c-name">Name</label>
            <input id="c-name" value={form.name} placeholder="Your name"
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="c-email">Email</label>
            <input id="c-email" type="email" value={form.email} placeholder="you@example.com"
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="c-msg">Message</label>
            <textarea id="c-msg" rows="6" value={form.message}
              placeholder="Tell us about your trip, dates, or anything we can help with…"
              onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 6 }}>Send message</button>
          <p className="contact-note">This demo form doesn't send email — submissions show a confirmation toast.</p>
        </form>
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="page">
      <div className="empty-state" style={{ paddingTop: 90 }}>
        <div className="e-ico">🧭</div>
        <h3>Trail not found</h3>
        <p style={{ marginBottom: 18 }}>
          This page doesn't exist — maybe the map was drawn before the snow melted.
        </p>
        <Link to="/" className="btn btn-primary">Back to Explore</Link>
      </div>
    </main>
  );
}
