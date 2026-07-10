import React from 'react';

export default function EmptyState({ icon = '🌲', title, children }) {
  return (
    <div className="empty-state">
      <div className="e-ico">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
