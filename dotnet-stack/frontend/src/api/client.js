const BASE = '/api';

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token || null;
}

/** Called when a request with a token gets a 401 (expired/invalid session). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError('NETWORK', 0);
  }
  if (!res.ok) {
    if (res.status === 401 && authToken) {
      // Session expired or token invalid — let the app sign the user out cleanly.
      onUnauthorized?.();
    }
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join('; ') : body.message || message;
    } catch { /* keep default */ }
    throw new ApiError(message, res.status);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let socket = null;
const EVENTS = ['booking.created', 'booking.updated', 'booking.deleted', 'availability.changed'];

/**
 * Minimal hand-rolled SignalR JSON-protocol client (no dependency) for the
 * ASP.NET Core backend: negotiate -> WebSocket -> handshake -> invocations.
 */
async function connectSignalR(onEvent) {
  const res = await fetch('/hubs/events/negotiate?negotiateVersion=1', { method: 'POST' });
  if (!res.ok) throw new Error('negotiate failed');
  const { connectionToken, connectionId } = await res.json();
  const id = connectionToken || connectionId;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/hubs/events?id=${encodeURIComponent(id)}`);
  const SEP = '\u001e';
  ws.onopen = () => ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + SEP);
  ws.onmessage = (e) => {
    for (const chunk of String(e.data).split(SEP)) {
      if (!chunk) continue;
      try {
        const msg = JSON.parse(chunk);
        if (msg.type === 1 && EVENTS.includes(msg.target)) onEvent(msg.target, msg.arguments?.[0]);
      } catch { /* ignore malformed frames */ }
    }
  };
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 6 }) + SEP);
  }, 15000);
  ws.onclose = () => clearInterval(ping);
  return ws;
}

/** Connect once; listeners receive real-time booking/availability events via SignalR. */
export function connectSocket(onEvent) {
  if (socket) return socket;
  socket = true; // guard while the async connect runs
  connectSignalR(onEvent)
    .then((ws) => { socket = ws; })
    .catch(() => { socket = null; });
  return socket;
}
