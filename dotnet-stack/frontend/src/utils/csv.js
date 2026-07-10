const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function bookingsToCsv(bookings) {
  const header = [
    'Booking ID', 'Hotel', 'Room', 'Location', 'Guest', 'Email', 'Phone',
    'Check-in', 'Check-out', 'Guests', 'Rooms', 'Total (CAD)', 'Status', 'Created',
  ].join(',');
  const lines = bookings.map((b) =>
    [
      b.id, b.hotel?.name, b.room?.name, b.hotel ? `${b.hotel.place}, ${b.hotel.region}` : '',
      b.guestName, b.email, b.phone, b.checkIn, b.checkOut, b.guests, b.rooms,
      Number(b.totalPrice).toFixed(2), b.status, b.createdAt,
    ].map(esc).join(','),
  );
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
