import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import HotelCard from '../components/HotelCard';
import FilterBar from '../components/FilterBar';
import EmptyState from '../components/EmptyState';

const HERO_IMG =
  'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1800&q=80';

/* Drone fly-through candidates, tried in order; the browser falls through to
   the next <source> on failure, and to the still image if none load. */
const HERO_VIDEOS = [
  'https://videos.pexels.com/video-files/3571264/3571264-uhd_3840_2160_30fps.mp4',
  'https://videos.pexels.com/video-files/2257010/2257010-uhd_3840_2160_24fps.mp4',
  'https://videos.pexels.com/video-files/857134/857134-hd_1280_720_25fps.mp4',
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
      aria-label="Drone flight over Canadian wilderness lodges"
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

function PerksStrip() {
  return (
    <section className="perks-strip" aria-label="Included with every stay">
      <h2 className="perks-title">Included with every stay</h2>
      <div className="perks-grid">
        {PERKS.map((p) => (
          <div key={p.title} className="perk-card">
            <span className="perk-icon">{p.icon}</span>
            <div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ExplorePage() {
  const hotels = useStore((s) => s.hotels);
  const loading = useStore((s) => s.loadingHotels);
  const offline = useStore((s) => s.offline);
  const loadHotels = useStore((s) => s.loadHotels);

  useEffect(() => {
    loadHotels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page">
      <section className="hero hero-cinematic">
        <HeroMedia />
        <div className="hero-content">
          <div className="kicker">Wilderness Refined</div>
          <h1>Where the mountains keep your reservation</h1>
          <p>
            Hand-picked lodges across the Canadian Rockies and coastal rainforest —
            timber warmth, stone hearths, and floor-to-ceiling wilderness.
          </p>
        </div>
      </section>

      <PerksStrip />

      {offline && (
        <div className="offline-banner">
          <span>🍂</span>
          Offline demo mode — the API isn't reachable, so hotels and bookings are served
          from your browser's local storage.
        </div>
      )}

      <FilterBar onApply={() => loadHotels()} />

      {loading ? (
        <div className="spinner" role="status" aria-label="Loading lodges" />
      ) : hotels.length === 0 ? (
        <EmptyState icon="🏔️" title="No lodges match your search">
          Try widening the price range, changing dates, or clearing the destination filter.
        </EmptyState>
      ) : (
        <div className="hotel-grid">
          {hotels.map((h) => (
            <HotelCard key={h.id} hotel={h} />
          ))}
        </div>
      )}
    </main>
  );
}
