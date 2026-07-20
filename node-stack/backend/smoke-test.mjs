/**
 * End-to-end smoke test for the Wilderness Stays API.
 * Run with the backend up:  npm run smoke
 * No dependencies — plain Node 18+ fetch. Cleans up after itself.
 */
const BASE = process.env.API_URL || 'http://localhost:3000/api';
let passed = 0, failed = 0;

const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
};

const req = async (path, { token, ...opts } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let body = null;
  try { body = await res.clone().json(); } catch { body = await res.text(); }
  return { status: res.status, body };
};

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

console.log(`Smoke-testing ${BASE}\n`);

// 1. health
let r = await req('/health');
ok('GET /health responds ok', r.status === 200 && r.body.status === 'ok', JSON.stringify(r.body));
console.log(`  (backend engine: ${r.body.engine || 'node'})`);

// 2. hotels list + detail with rooms
r = await req('/hotels');
ok('GET /hotels returns hotels', r.status === 200 && r.body.length > 0);
const hotel = r.body[0];
r = await req(`/hotels/${hotel.id}?checkIn=${day(150)}&checkOut=${day(152)}`);
ok('GET /hotels/:id includes rooms with availability', r.status === 200 && r.body.rooms?.length > 0 && 'available' in r.body.rooms[0]);
const room = r.body.rooms.find((x) => x.available);

// 3. calendar
r = await req(`/hotels/${hotel.id}/calendar?start=${day(150)}&days=14&roomId=${room.id}`);
ok('GET calendar (per-room) returns day entries', r.status === 200 && r.body.length === 14 && 'available' in r.body[0]);

// 4. auth: register + login guard
const email = `smoke-${Date.now()}@example.com`;
r = await req('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Smoke Test', email, password: 'smoke123' }) });
ok('POST /auth/register issues token', r.status === 201 && !!r.body.token);
const guest = r.body.token;
r = await req('/bookings/mine');
ok('GET /bookings/mine without token → 401', r.status === 401);

// 5. booking flow
const payload = {
  hotelId: hotel.id, roomId: room.id, guestName: 'Smoke Test', email,
  checkIn: day(150), checkOut: day(152), guests: 2,
};
r = await req('/bookings', { method: 'POST', token: guest, body: JSON.stringify(payload) });
ok('POST /bookings creates booking', r.status === 201 && r.body.status === 'confirmed', JSON.stringify(r.body.message || ''));
const bookingId = r.body.id;

// 6. room-blocking: same room+dates conflicts; sibling room books fine
r = await req('/bookings', { method: 'POST', token: guest, body: JSON.stringify(payload) });
ok('duplicate room+dates → 409 conflict', r.status === 409);
r = await req(`/hotels/${hotel.id}?checkIn=${day(150)}&checkOut=${day(152)}`);
ok('booked room now shows unavailable', r.body.rooms.find((x) => x.id === room.id)?.available === false);

// 7. capacity guard
const small = r.body.rooms.find((x) => x.available && x.capacity < 20);
if (small) {
  const over = { ...payload, roomId: small.id, guests: small.capacity + 1 };
  const rr = await req('/bookings', { method: 'POST', token: guest, body: JSON.stringify(over) });
  ok('guests above room capacity → 400', rr.status === 400);
}

// 8. my bookings + ownership + admin
r = await req('/bookings/mine', { token: guest });
ok('GET /bookings/mine shows own booking', r.status === 200 && r.body.some((b) => b.id === bookingId));
r = await req('/bookings', { token: guest });
ok('guest blocked from admin list → 403', r.status === 403);
r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@wilderness.ca', password: 'admin123' }) });
ok('admin login works', r.status === 201 && !!r.body.token);
const admin = r.body.token;
r = await req('/bookings', { token: admin });
ok('admin sees all bookings', r.status === 200 && Array.isArray(r.body));
r = await req('/bookings/export/csv', { token: admin });
ok('admin CSV export works', r.status === 200 && String(r.body).includes('Booking ID'));

// 9. cancel frees the room; cleanup
r = await req(`/bookings/${bookingId}`, { method: 'PATCH', token: guest, body: JSON.stringify({ status: 'cancelled' }) });
ok('guest cancels own booking', r.status === 200 && r.body.status === 'cancelled');
r = await req(`/hotels/${hotel.id}?checkIn=${day(150)}&checkOut=${day(152)}`);
ok('cancelled booking frees the room', r.body.rooms.find((x) => x.id === room.id)?.available === true);
r = await req(`/bookings/${bookingId}`, { method: 'DELETE', token: guest });
ok('guest deletes own booking', r.status === 200);

// 10. cancellation policy
const far = { ...payload, checkIn: day(200), checkOut: day(202) };
r = await req('/bookings', { method: 'POST', token: guest, body: JSON.stringify(far) });
const farId = r.body.id;
const farTotal = Number(r.body.totalPrice);
r = await req(`/bookings/${farId}/cancellation-quote`, { token: guest });
ok('quote: free cancellation when 7+ days out', r.status === 200 && r.body.cancellable === true && r.body.feePercent === 0 && Number(r.body.refund) > 0);
r = await req(`/bookings/${farId}/cancel`, { method: 'POST', token: guest });
ok('cancel: full refund recorded',
  r.status === 200 && r.body.status === 'cancelled' && Number(r.body.cancellationFee) === 0
  && Math.abs(Number(r.body.refundAmount) - farTotal) < 0.02 && !!r.body.refundRef);
await req(`/bookings/${farId}`, { method: 'DELETE', token: guest });

r = await req(`/hotels/${hotel.id}?checkIn=${day(3)}&checkOut=${day(5)}`);
const nearRoom = r.status === 200 && Array.isArray(r.body?.rooms)
  ? r.body.rooms.find((x) => x.available)
  : null;
ok('setup: near-term room available for the 70% fee scenario', Boolean(nearRoom));
if (nearRoom) {
  const near = { ...payload, roomId: nearRoom.id, checkIn: day(3), checkOut: day(5) };
  r = await req('/bookings', { method: 'POST', token: guest, body: JSON.stringify(near) });
  const nearId = r.body.id;
  const nearTotal = Number(r.body.totalPrice);
  r = await req(`/bookings/${nearId}/cancellation-quote`, { token: guest });
  ok('quote: 70% fee within 7 days of check-in', r.status === 200 && r.body.feePercent === 70);
  r = await req(`/bookings/${nearId}/cancel`, { method: 'POST', token: guest });
  ok('cancel: 30% refund within 7 days', r.status === 200 && Math.abs(Number(r.body.refundAmount) - nearTotal * 0.3) < 0.02);
  await req(`/bookings/${nearId}`, { method: 'DELETE', token: guest });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
