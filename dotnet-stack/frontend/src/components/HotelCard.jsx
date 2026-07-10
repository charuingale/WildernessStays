import React from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../utils/dates';

export default function HotelCard({ hotel }) {
  const availClass = hotel.roomsAvailable === 0 ? 'none' : '';
  return (
    <Link to={`/hotel/${hotel.id}`} className="hotel-card" aria-label={`View ${hotel.name}`}>
      <div className="card-img">
        <img src={hotel.images[0]} alt={hotel.name} loading="lazy" />
        {hotel.roomsAvailable === 0 ? (
          <span className="badge soldout">Fully booked</span>
        ) : (
          <span className="badge">{hotel.place}, {hotel.region}</span>
        )}
        <span className="rating-chip">★ {Number(hotel.rating).toFixed(1)}</span>
      </div>
      <div className="card-body">
        <span className="place">{hotel.place} · {hotel.region}</span>
        <h3>{hotel.name}</h3>
        <p className="desc">{hotel.description}</p>
        <div className="amenity-row">
          {hotel.amenities.slice(0, 3).map((a) => (
            <span key={a} className="amenity-tag">{a}</span>
          ))}
          {hotel.amenities.length > 3 && (
            <span className="amenity-tag">+{hotel.amenities.length - 3} more</span>
          )}
        </div>
        <div className="card-foot">
          <span className="price">
            <small>from</small> {formatMoney(hotel.pricePerNight)} <small>/ night</small>
          </span>
          <span className={`avail-note ${availClass}`}>
            {hotel.roomsAvailable === 0
              ? 'Fully booked for these dates'
              : `${hotel.roomsAvailable} of ${hotel.roomsTotal} rooms free`}
          </span>
        </div>
      </div>
    </Link>
  );
}
