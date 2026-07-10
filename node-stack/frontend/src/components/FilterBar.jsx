import React from 'react';
import { useStore } from '../store/useStore';
import { todayISO } from '../utils/dates';

export default function FilterBar({ onApply }) {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);

  const submit = (e) => {
    e.preventDefault();
    onApply();
  };

  return (
    <form className="filterbar" onSubmit={submit} aria-label="Filter hotels">
      <div className="field">
        <label htmlFor="f-place">Destination</label>
        <input
          id="f-place"
          type="text"
          placeholder="Banff, Whistler, Tofino…"
          value={filters.place}
          onChange={(e) => setFilters({ place: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="f-in">Check-in</label>
        <input
          id="f-in"
          type="date"
          min={todayISO()}
          value={filters.checkIn}
          onChange={(e) => setFilters({ checkIn: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="f-out">Check-out</label>
        <input
          id="f-out"
          type="date"
          min={filters.checkIn || todayISO(1)}
          value={filters.checkOut}
          onChange={(e) => setFilters({ checkOut: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="f-min">Min $ / night</label>
        <input
          id="f-min"
          type="number"
          min="0"
          placeholder="0"
          value={filters.minPrice}
          onChange={(e) => setFilters({ minPrice: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="f-max">Max $ / night</label>
        <input
          id="f-max"
          type="number"
          min="0"
          placeholder="700"
          value={filters.maxPrice}
          onChange={(e) => setFilters({ maxPrice: e.target.value })}
        />
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => setFilters({ availableOnly: e.target.checked })}
        />
        <span>Available only</span>
      </label>
      <button type="submit" className="btn btn-primary">Search</button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => { resetFilters(); setTimeout(onApply, 0); }}
      >
        Reset
      </button>
    </form>
  );
}
