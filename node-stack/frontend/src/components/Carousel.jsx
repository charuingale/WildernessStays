import React, { useCallback, useEffect, useState } from 'react';

export default function Carousel({ images, alt }) {
  const [idx, setIdx] = useState(0);
  const count = images.length;

  const go = useCallback(
    (delta) => setIdx((i) => (i + delta + count) % count),
    [count],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (!count) return null;

  return (
    <div className="carousel">
      <div className="carousel-main">
        <img src={images[idx]} alt={`${alt} — photo ${idx + 1} of ${count}`} />
        {count > 1 && (
          <>
            <button className="carousel-arrow left" aria-label="Previous photo" onClick={() => go(-1)}>‹</button>
            <button className="carousel-arrow right" aria-label="Next photo" onClick={() => go(1)}>›</button>
            <span className="carousel-counter">{idx + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="carousel-thumbs" role="tablist">
          {images.map((src, i) => (
            <button
              key={src}
              role="tab"
              aria-selected={i === idx}
              className={`carousel-thumb ${i === idx ? 'active' : ''}`}
              onClick={() => setIdx(i)}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
