import React from 'react';
import { Link } from 'react-router-dom';

const HERO_IMG =
  'https://images.pexels.com/videos/20600550/4k-alberta-banff-blue-20600550.jpeg?auto=compress&w=1800';

/* Mountain drone footage, tried in order; the browser falls through to the
   next <source> on failure, and to the still image if none load. */
const HERO_VIDEOS = [
  // Moraine Lake, Banff — mountains reflected at dawn (Pexels #20600550, 1440p) — verified file URL
  'https://videos.pexels.com/video-files/20600550/20600550-uhd_2560_1440_30fps.mp4',
  // Moraine Lake at dusk (Pexels #35080559) via stable download redirect
  'https://www.pexels.com/download/video/35080559/',
  // Canadian Rockies — Moraine Lake (Pexels #19618462) via stable download redirect
  'https://www.pexels.com/download/video/19618462/',
];

/** Autoplaying, muted drone footage with a slow push-in for a fly-through feel. */
function HeroMedia() {
  const [videoFailed, setVideoFailed] = React.useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  if (videoFailed) {
    return <img className="hero-media kenburns" src={HERO_IMG} alt="Aerial view of a turquoise alpine lake beneath the Canadian Rockies" />;
  }
  return (
    <video
      className="hero-media hero-video"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={HERO_IMG}
      aria-label="Drone flight over Canadian mountain wilderness"
      onError={() => setVideoFailed(true)}
    >
      {HERO_VIDEOS.map((src) => (
        <source key={src} src={src} type="video/mp4" />
      ))}
    </video>
  );
}

/* Signature comforts included with every stay. */
const PERKS = [
  { icon: '🥞', title: 'Buffet breakfast', text: 'Chef-led alpine breakfast, included every morning.' },
  { icon: '🅿️', title: 'Free parking', text: 'On-site parking and EV charging at every lodge, no fees.' },
  { icon: '🔄', title: 'Flexible cancellation', text: 'Free until 7 days before check-in — plans change, we get it.' },
  { icon: '🛬', title: 'Airport pickup & drop-off', text: 'Private transfers from the nearest airport, arranged by our concierge.' },
];

const IMG = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/* People on the trail — Banff & Jasper country. */
const HIKE_MAIN = IMG('photo-1551632811-561732d1e306', 1000);
const HIKE_ACCENT = IMG('photo-1476900543704-4312b78632f8', 700);

/* Signature amenities across the collection. */
const AMENITIES = [
  { img: IMG('photo-1561501900-3701fa6a0864'), icon: '♨️', title: 'Pool & hot tubs', text: 'Heated pools and cedar hot tubs under the peaks.' },
  { img: IMG('photo-1504754524776-8f4f37790ca0'), icon: '🥞', title: 'Buffet breakfast', text: 'Chef-led alpine spread, included every morning.' },
  { img: IMG('photo-1541364983171-a8ba01e95cfc'), icon: '🐾', title: 'Pet-friendly rooms', text: 'Trail dogs welcome — beds, bowls and treats provided.' },
  { img: IMG('photo-1497032628192-86f99bcd76bc'), icon: '📶', title: 'High-speed Wi-Fi', text: 'Fibre-fast and free, even this far into the wild.' },
  { img: IMG('photo-1533473359331-0135ef1b58bf'), icon: '🅿️', title: 'Free parking', text: 'On-site parking with EV charging at every lodge.' },
  { img: IMG('photo-1534438327276-14e5300c3a48'), icon: '🏋️', title: 'Fitness rooms', text: 'Train with a view before the trail does it for you.' },
];

const STATS = [
  { value: '8', label: 'Independent lodges' },
  { value: '24', label: 'One-of-a-kind rooms' },
  { value: '3', label: 'Provinces, coast to peaks' },
  { value: '7 days', label: 'Free cancellation window' },
];

export default function HomePage() {
  return (
    <>
      <section className="hero-cinema" aria-label="Wilderness Stays">
        <HeroMedia />
        <div className="hero-scrim" />
        <div className="hero-inner">
          <div className="hero-kicker"><span /> Wilderness Refined <span /></div>
          <h1>
            Where the mountains <em>keep</em> your reservation
          </h1>
          <p>
            Hand-picked lodges across the Canadian Rockies and coastal rainforest —
            timber warmth, stone hearths, and floor-to-ceiling wilderness.
          </p>
          <Link to="/search" className="btn btn-timber btn-hero">
            Book Now
          </Link>
        </div>
        <div className="hero-perks" aria-label="Included with every stay">
          <span className="hero-perks-label">Included with every stay</span>
          <div className="hero-perks-row">
            {PERKS.map((perk) => (
              <div key={perk.title} className="hero-perk">
                <span className="p-icon">{perk.icon}</span>
                <div>
                  <h3>{perk.title}</h3>
                  <p>{perk.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="page">
        <section className="about-split">
          <div className="about-text">
            <div className="sub">Who we are</div>
            <h2>Eight lodges, rooted in the Canadian wild</h2>
            <p>
              Wilderness Stays is a curated collection of independent timber-and-stone lodges
              across the Rockies, the Pacific coast and the Laurentians. Every room is a real,
              one-of-a-kind space with its own view and character — once it's booked for your
              dates, it's yours alone. Browse the collection, watch live availability on the
              calendar, and reserve in minutes with instant confirmation.
            </p>
            <div className="home-stats">
              {STATS.map((s) => (
                <div key={s.label} className="home-stat">
                  <span className="s-num">{s.value}</span>
                  <span className="s-lab">{s.label}</span>
                </div>
              ))}
            </div>
            <div className="home-links">
              <Link to="/search" className="btn btn-primary">Browse the lodges</Link>
              <Link to="/about" className="btn btn-ghost">Our story</Link>
            </div>
          </div>
          <div className="about-collage" aria-hidden="true">
            <img className="collage-main" src={HIKE_MAIN} alt="Hikers walking a mountain trail in Banff" loading="lazy" />
            <img className="collage-accent" src={HIKE_ACCENT} alt="Hiker at sunrise in the Rockies" loading="lazy" />
            <span className="collage-badge">Banff · Jasper · Tofino</span>
          </div>
        </section>

        <section className="amenity-showcase">
          <div className="showcase-head">
            <div className="sub">Signature amenities</div>
            <h2>Everything a wild weekend needs</h2>
          </div>
          <div className="showcase-grid">
            {AMENITIES.map((a) => (
              <figure key={a.title} className="showcase-card">
                <img src={a.img} alt={a.title} loading="lazy" />
                <figcaption>
                  <span className="sc-icon">{a.icon}</span>
                  <div>
                    <h3>{a.title}</h3>
                    <p>{a.text}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
