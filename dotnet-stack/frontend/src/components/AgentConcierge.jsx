import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useStore } from '../store/useStore';

/**
 * AI Concierge — a free-text assistant backed by the /api/agent/chat endpoint
 * (Amazon Bedrock). It can search lodges, check availability and manage the
 * signed-in guest's own bookings. Booking and cancellation are never executed
 * without an explicit confirmation step, surfaced here as a card the guest
 * approves or declines.
 */
export default function AgentConcierge() {
  const user = useStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your concierge. Ask me to find a lodge, check dates, or manage a booking." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null); // { kind, summary, details, resumeToken }
  const threadRef = useRef(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, pending, open]);

  const say = (role, text) => setMessages((m) => [...m, { role, text }]);

  /** Apply a server response: show the reply, then either surface a confirmation or clear one. */
  const applyResponse = (res) => {
    if (res?.reply) say('assistant', res.reply);
    setPending(res?.status === 'needs_confirmation' ? res.pendingAction : null);
  };

  const post = async (body) => {
    setLoading(true);
    try {
      applyResponse(await api('/agent/chat', { method: 'POST', body: JSON.stringify(body) }));
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 0
        ? 'The concierge is unreachable right now.'
        : err.message || 'Something went wrong.';
      say('assistant', `⚠ ${msg}`);
      setPending(null);
    } finally {
      setLoading(false);
    }
  };

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setPending(null);
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    await post({ messages: next.map(({ role, text }) => ({ role, text })) });
  };

  const decide = async (approved) => {
    if (!pending || loading) return;
    const token = pending.resumeToken;
    setPending(null);
    say('user', approved ? '✓ Confirmed' : '✕ Not now');
    await post({
      messages: messages.map(({ role, text }) => ({ role, text })),
      confirm: { resumeToken: token, approved },
    });
  };

  return (
    <>
      <button
        className={`chatbot-fab ${open ? 'open' : ''}`}
        style={{ left: 24, right: 'auto' }}
        aria-label={open ? 'Close concierge' : 'Open AI concierge'}
        onClick={() => setOpen(!open)}
      >
        {open ? '✕' : '🛎️'}
        {!open && <span className="fab-label">Concierge</span>}
      </button>

      {open && (
        <section className="chatbot-panel" style={{ left: 24, right: 'auto' }} aria-label="AI concierge">
          <header className="chatbot-head">
            <span className="chatbot-avatar">🛎️</span>
            <div>
              <strong>AI Concierge</strong>
              <p>Lodges, availability & your bookings</p>
            </div>
          </header>

          <div className="chat-thread" ref={threadRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === 'user' ? 'user' : 'bot'}`}>{m.text}</div>
            ))}
            {loading && <div className="chat-msg bot typing"><span /><span /><span /></div>}

            {pending && (
              <div
                className="chat-msg bot"
                style={{ borderLeft: '3px solid var(--accent, #2f6f4f)', background: 'rgba(47,111,79,0.08)' }}
              >
                <strong style={{ display: 'block', marginBottom: 6 }}>
                  {pending.kind === 'cancel_booking' ? 'Confirm cancellation' : 'Confirm booking'}
                </strong>
                <span>{pending.summary}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={() => decide(true)}>
                    Confirm
                  </button>
                  <button className="btn btn-sm" disabled={loading} onClick={() => decide(false)}>
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-area">
            {user ? (
              <form className="chat-textrow" onSubmit={send}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the concierge…"
                  aria-label="Message the concierge"
                  disabled={loading}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
                  Send
                </button>
              </form>
            ) : (
              <p style={{ padding: '10px 4px', margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
                Please sign in to chat with the concierge.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
