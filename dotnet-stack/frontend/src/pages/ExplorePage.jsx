import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import HotelCard from '../components/HotelCard';
import FilterBar from '../components/FilterBar';
import EmptyState from '../components/EmptyState';

const HERO_IMG =
  'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1800&q=80';

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
      <section className="hero">
        <img src={HERO_IMG} alt="Turquoise alpine lake beneath the Canadian Rockies" />
        <div className="hero-content">
          <div className="kicker">Wilderness Refined</div>
          <h1>Where the mountains keep your reservation</h1>
          <p>
            Hand-picked lodges across the Canadian Rockies and coastal rainforest —
            timber warmth, stone hearths, and floor-to-ceiling wilderness.
          </p>
        </div>
      </section>

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
