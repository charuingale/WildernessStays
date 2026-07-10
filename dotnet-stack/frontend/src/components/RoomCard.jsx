import React, { useState } from 'react';
import { formatMoney } from '../utils/dates';

export default function RoomCard({ room, selected, onSelect }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = room.images || [];
  const unavailable = room.available === false;

  return (
    <article className={`room-card ${selected ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}`}>
      <div className="room-img">
        <img src={images[imgIdx]} alt={room.name} loading="lazy" />
        {images.length > 1 && (
          <div className="room-img-dots">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Photo ${i + 1}`}
                className={i === imgIdx ? 'on' : ''}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
              />
            ))}
          </div>
        )}
        {unavailable && <span className="badge soldout room-badge">Booked for these dates</span>}
        {selected && !unavailable && <span className="badge room-badge selected-badge">✓ Selected</span>}
      </div>
      <div className="room-body">
        <div className="room-head">
          <h3>{room.name}</h3>
          <span className="room-cap">👤 Sleeps {room.capacity}</span>
        </div>
        <p className="room-desc">{room.description}</p>
        <div className="amenity-row">
          {room.amenities.map((a) => (
            <span key={a} className="amenity-tag">{a}</span>
          ))}
        </div>
        <div className="card-foot">
          <span className="price">
            {formatMoney(room.pricePerNight)} <small>/ night</small>
          </span>
          <button
            type="button"
            className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-ghost'}`}
            disabled={unavailable}
            onClick={() => onSelect(selected ? null : room)}
          >
            {unavailable ? 'Unavailable' : selected ? 'Selected ✓' : 'Select room'}
          </button>
        </div>
      </div>
    </article>
  );
}
