import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import HotelCard from '../components/HotelCard';
import FilterBar from '../components/FilterBar';
import EmptyState from '../components/EmptyState';

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
      <div className="detail-title section">
        <div className="sub">The collection</div>
        <h1>Find your lodge</h1>
      </div>

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
