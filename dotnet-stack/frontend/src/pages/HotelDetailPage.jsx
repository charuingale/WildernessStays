import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import BookingForm from '../components/BookingForm';
import Carousel from '../components/Carousel';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import RoomCard from '../components/RoomCard';
import { formatMoney } from '../utils/dates';

const AMENITY_ICONS = {
  spa: '💆', sauna: '🧖', pool: '🏊', hot: '♨️', fire: '🔥', dining: '🍽️', restaurant: '🍽️',
  bistro: '🍽️', tea: '🫖', ski: '🎿', shuttle: '🚐', 'wi-fi': '📶', wifi: '📶', ev: '🔌',
  parking: '🅿️', canoe: '🛶', paddle: '🛶', surf: '🏄', bike: '🚲', hik: '🥾', trail: '🥾',
  star: '🔭', telescope: '🔭', pet: '🐾', valet: '🔑', concierge: '🛎️', fitness: '🏋️',
  beach: '🏖️', breakfast: '🥐', lunch: '🧺', solar: '☀️', kitchen: '👨‍🍳', library: '📚',
  wildlife: '🦌', storm: '🌊', stove: '🔥',
};

const iconFor = (amenity) => {
  const a = amenity.toLowerCase();
  for (const key of Object.keys(AMENITY_ICONS)) if (a.includes(key)) return AMENITY_ICONS[key];
  return '✦';
};

export default function HotelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loadHotel = useStore((s) => s.loadHotel);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const cached = useStore((s) => s.getHotel(id));
  const [hotel, setHotel] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(!hotel);
    loadHotel(id).then((h) => {
      if (!alive) return;
      if (h) {
        setHotel(h);
        // Keep the selection in sync with fresh availability; drop it if the room became unavailable.
        setSelectedRoom((prev) => {
          if (!prev || !h.rooms) return prev;
          const updated = h.rooms.find((r) => r.id === prev.id);
          return updated && updated.available !== false ? updated : null;
        });
      }
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, filters.checkIn, filters.checkOut]);

  if (loading) return <main className="page"><div className="spinner" role="status" /></main>;

  if (!hotel) {
    return (
      <main className="page">
        <div className="empty-state">
          <div className="e-ico">🧭</div>
          <h3>Lodge not found</h3>
          <p><Link to="/search" style={{ color: 'var(--timber)', fontWeight: 600 }}>Back to search</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="breadcrumb">
        <Link to="/search">Search</Link> <span>›</span> <span>{hotel.name}</span>
      </div>

      <div className="detail-title section">
        <div className="sub">{hotel.place}, {hotel.region} · ★ {Number(hotel.rating).toFixed(1)}</div>
        <h1>{hotel.name}</h1>
      </div>

      <Carousel images={hotel.images} alt={hotel.name} />

      <div className="detail-layout">
        <div>
          <section className="section">
            <h2>The lodge</h2>
            <p>{hotel.description}</p>
            <div className="room-callout">
              <strong>Your room · </strong>{hotel.roomDescription}
            </div>
          </section>

          <section className="section" id="rooms">
            <h2>Choose your room</h2>
            <p style={{ marginBottom: 14 }}>
              Each room is a one-of-a-kind space — once booked for your dates, it's blocked for everyone else.
            </p>
            <div className="room-list">
              {(hotel.rooms || []).map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  selected={selectedRoom?.id === room.id}
                  onSelect={setSelectedRoom}
                />
              ))}
            </div>
          </section>

          <section className="section">
            <h2>Availability</h2>
            <AvailabilityCalendar
              hotel={hotel}
              room={selectedRoom}
              checkIn={filters.checkIn}
              checkOut={filters.checkOut}
              onRange={(checkIn, checkOut) => setFilters({ checkIn, checkOut })}
            />
          </section>

          <section className="section">
            <h2>Amenities</h2>
            <div className="amenity-grid">
              {hotel.amenities.map((a) => (
                <div key={a} className="amenity-cell">
                  <span>{iconFor(a)}</span> {a}
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h2>Nearby</h2>
            <div className="nearby-list">
              {hotel.nearbyPlaces.map((p) => (
                <div key={p.name} className="nearby-item">
                  <div>
                    <div className="n-name">{p.name}</div>
                    <div className="n-type">{p.type}</div>
                  </div>
                  <span className="n-dist">{p.distance}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="booking-panel">
          <h3>Reserve your stay</h3>
          <div className="panel-price">
            {selectedRoom ? (
              <>
                <div className="panel-room">{selectedRoom.name} · 👤 sleeps {selectedRoom.capacity}</div>
                <span className="price">{formatMoney(selectedRoom.pricePerNight)} <small>/ night</small></span>
              </>
            ) : (
              <span className="price"><small>from</small> {formatMoney(hotel.pricePerNight)} <small>/ night</small></span>
            )}
            {hotel.roomsAvailable != null && (
              <div className={`avail-note ${hotel.roomsAvailable === 0 ? 'none' : hotel.roomsAvailable < hotel.roomsTotal ? 'low' : ''}`}>
                {hotel.roomsAvailable === 0
                  ? 'Fully booked for the selected dates'
                  : `${hotel.roomsAvailable} of ${hotel.roomsTotal} rooms free for your dates`}
              </div>
            )}
          </div>
          <BookingForm
            hotel={hotel}
            room={selectedRoom}
            range={{ checkIn: filters.checkIn, checkOut: filters.checkOut }}
            onBooked={() => navigate('/trips')}
          />
        </aside>
      </div>
    </main>
  );
}
