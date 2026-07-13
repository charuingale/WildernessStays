import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, ApiError, connectSocket, setAuthToken, setUnauthorizedHandler } from '../api/client';
import seedHotels from '../data/hotels.json';
import { todayISO, nightsBetween, rangesOverlap } from '../utils/dates';
import { localCancellationQuote } from '../utils/policy';

/* Seed hotels + rooms get stable local ids so offline mode works deterministically. */
const localHotels = seedHotels.map((h, i) => ({
  ...h,
  id: `local-${i + 1}`,
  rooms: (h.rooms || []).map((r, j) => ({ ...r, id: `local-${i + 1}-r${j + 1}`, hotelId: `local-${i + 1}` })),
}));

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const defaultFilters = {
  place: '',
  minPrice: '',
  maxPrice: '',
  availableOnly: false,
  checkIn: todayISO(1),
  checkOut: todayISO(3),
};

/** Room ids blocked by active overlapping bookings (offline mode). */
function blockedRoomIds(hotelId, bookings, checkIn, checkOut) {
  return new Set(
    bookings
      .filter(
        (b) =>
          b.hotelId === hotelId &&
          b.roomId &&
          b.status !== 'cancelled' &&
          rangesOverlap(b.checkIn, b.checkOut, checkIn, checkOut),
      )
      .map((b) => b.roomId),
  );
}

/** Free-room count for a hotel over a range (offline mode). */
function localAvailability(hotel, bookings, checkIn, checkOut) {
  const blocked = blockedRoomIds(hotel.id, bookings, checkIn, checkOut);
  return Math.max(0, (hotel.rooms || []).length - blocked.size);
}

/** Attach per-room availability flags (offline mode). */
function withRoomAvailability(hotel, bookings, checkIn, checkOut) {
  const blocked = blockedRoomIds(hotel.id, bookings, checkIn, checkOut);
  return {
    ...hotel,
    rooms: (hotel.rooms || []).map((r) => ({ ...r, available: !blocked.has(r.id) })),
    roomsAvailable: localAvailability(hotel, bookings, checkIn, checkOut),
  };
}

/** Per-day availability from local bookings (offline calendar). */
export function localCalendar(hotel, bookings, startISO, days, roomId) {
  const total = roomId ? 1 : (hotel.rooms || []).length;
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.parse(startISO) + i * 86400000).toISOString().slice(0, 10);
    const blocked = new Set(
      bookings
        .filter(
          (b) =>
            b.hotelId === hotel.id &&
            b.roomId &&
            (!roomId || b.roomId === roomId) &&
            b.status !== 'cancelled' &&
            b.checkIn <= date && date < b.checkOut,
        )
        .map((b) => b.roomId),
    );
    out.push({ date, available: Math.max(0, total - blocked.size), total });
  }
  return out;
}

export { localHotels };

export const useStore = create(
  persist(
    (set, get) => ({
      /* ------------ state ------------ */
      hotels: [],
      bookings: [],       // admin view (or local bookings when offline)
      myBookings: [],     // signed-in guest's own bookings
      localBookings: [],  // persisted; used when the backend is unreachable
      user: null,
      token: null,
      offline: false,
      loadingHotels: false,
      loadingBookings: false,
      loadingMy: false,
      submitting: false,
      authBusy: false,
      toasts: [],
      filters: { ...defaultFilters },
      bookingSearch: '',
      bookingStatus: '',
      socketReady: false,

      /* ------------ toasts ------------ */
      toast(message, kind = 'info') {
        const id = uid();
        set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
      },

      /* ------------ auth ------------ */
      async login(email, password) {
        set({ authBusy: true });
        try {
          const { token, user } = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          });
          setAuthToken(token);
          set({ token, user, authBusy: false });
          get().toast(`Welcome back, ${user.name.split(' ')[0]}`, 'success');
          return user;
        } catch (err) {
          set({ authBusy: false });
          const msg = err.status === 0 ? 'Backend unreachable — sign-in unavailable in offline demo' : err.message;
          get().toast(msg, 'error');
          throw err;
        }
      },

      async register(name, email, password) {
        set({ authBusy: true });
        try {
          const { token, user } = await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
          });
          setAuthToken(token);
          set({ token, user, authBusy: false });
          get().toast(`Welcome to Wilderness Stays, ${user.name.split(' ')[0]}`, 'success');
          return user;
        } catch (err) {
          set({ authBusy: false });
          const msg = err.status === 0 ? 'Backend unreachable — sign-up unavailable in offline demo' : err.message;
          get().toast(msg, 'error');
          throw err;
        }
      },

      logout() {
        setAuthToken(null);
        set({ token: null, user: null, myBookings: [], bookings: get().offline ? get().bookings : [] });
        get().toast('Signed out');
      },

      isAdmin() {
        return get().user?.role === 'admin';
      },

      /* ------------ filters ------------ */
      setFilters(patch) {
        set((s) => ({ filters: { ...s.filters, ...patch } }));
      },
      resetFilters() {
        set({ filters: { ...defaultFilters } });
      },
      setBookingSearch(v) { set({ bookingSearch: v }); },
      setBookingStatus(v) { set({ bookingStatus: v }); },

      /* ------------ realtime ------------ */
      initSocket() {
        if (get().socketReady || get().offline) return;
        connectSocket((event) => {
          get().refreshBookingViews();
          get().loadHotels({ silent: true });
          if (event === 'booking.created') get().toast('A booking was just confirmed', 'success');
        });
        set({ socketReady: true });
      },

      refreshBookingViews() {
        const { offline, token, user } = get();
        if (offline || user?.role === 'admin') get().loadBookings({ silent: true });
        if (token && !offline) get().loadMyBookings({ silent: true });
      },

      /* ------------ hotels ------------ */
      async loadHotels({ silent = false } = {}) {
        const { filters } = get();
        if (!silent) set({ loadingHotels: true });
        const params = new URLSearchParams();
        if (filters.place) params.set('place', filters.place);
        if (filters.minPrice !== '') params.set('minPrice', filters.minPrice);
        if (filters.maxPrice !== '') params.set('maxPrice', filters.maxPrice);
        if (filters.availableOnly) params.set('availableOnly', 'true');
        if (filters.checkIn) params.set('checkIn', filters.checkIn);
        if (filters.checkOut) params.set('checkOut', filters.checkOut);
        try {
          const hotels = await api(`/hotels?${params.toString()}`);
          set({ hotels, offline: false, loadingHotels: false });
          get().initSocket();
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            const { localBookings } = get();
            const ci = filters.checkIn || todayISO();
            const co = filters.checkOut || todayISO(1);
            let hotels = localHotels
              .map((h) => ({ ...h, roomsAvailable: localAvailability(h, localBookings, ci, co) }))
              .filter((h) => {
                const q = filters.place.trim().toLowerCase();
                if (q && !`${h.place} ${h.region} ${h.name}`.toLowerCase().includes(q)) return false;
                if (filters.minPrice !== '' && h.pricePerNight < Number(filters.minPrice)) return false;
                if (filters.maxPrice !== '' && h.pricePerNight > Number(filters.maxPrice)) return false;
                if (filters.availableOnly && h.roomsAvailable === 0) return false;
                return true;
              })
              .sort((a, b) => b.rating - a.rating);
            set({ hotels, offline: true, loadingHotels: false });
          } else {
            set({ loadingHotels: false });
            get().toast(err.message, 'error');
          }
        }
      },

      getHotel(id) {
        return get().hotels.find((h) => h.id === id) || localHotels.find((h) => h.id === id);
      },

      async loadHotel(id) {
        const { filters } = get();
        try {
          const params = new URLSearchParams();
          if (filters.checkIn) params.set('checkIn', filters.checkIn);
          if (filters.checkOut) params.set('checkOut', filters.checkOut);
          return await api(`/hotels/${id}?${params.toString()}`);
        } catch {
          const hotel = localHotels.find((h) => h.id === id);
          if (!hotel) return null;
          return withRoomAvailability(
            hotel, get().localBookings,
            filters.checkIn || todayISO(), filters.checkOut || todayISO(1),
          );
        }
      },

      /** Calendar data with offline fallback. Optional roomId narrows to one room. */
      async loadCalendar(hotel, startISO, days, roomId) {
        try {
          const extra = roomId ? `&roomId=${roomId}` : '';
          return await api(`/hotels/${hotel.id}/calendar?start=${startISO}&days=${days}${extra}`);
        } catch {
          const local = localHotels.find((h) => h.id === hotel.id) || hotel;
          return localCalendar(local, get().localBookings, startISO, days, roomId);
        }
      },

      /* ------------ bookings: admin list ------------ */
      async loadBookings({ silent = false } = {}) {
        if (!silent) set({ loadingBookings: true });
        const { bookingSearch, bookingStatus } = get();
        const params = new URLSearchParams();
        if (bookingSearch) params.set('search', bookingSearch);
        if (bookingStatus) params.set('status', bookingStatus);
        try {
          const bookings = await api(`/bookings?${params.toString()}`);
          set({ bookings, offline: false, loadingBookings: false });
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            const q = bookingSearch.trim().toLowerCase();
            const bookings = get()
              .localBookings.filter((b) => {
                if (bookingStatus && b.status !== bookingStatus) return false;
                if (!q) return true;
                return `${b.guestName} ${b.email} ${b.hotel?.name} ${b.hotel?.place}`
                  .toLowerCase()
                  .includes(q);
              })
              .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
            set({ bookings, offline: true, loadingBookings: false });
          } else {
            set({ loadingBookings: false });
            if (err.status !== 401 && err.status !== 403) get().toast(err.message, 'error');
          }
        }
      },

      /* ------------ bookings: my trips ------------ */
      async loadMyBookings({ silent = false } = {}) {
        if (!silent) set({ loadingMy: true });
        try {
          const myBookings = await api('/bookings/mine');
          set({ myBookings, offline: false, loadingMy: false });
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            set({ myBookings: get().localBookings, offline: true, loadingMy: false });
          } else {
            set({ loadingMy: false });
            if (err.status !== 401) get().toast(err.message, 'error');
          }
        }
      },

      async createBooking(payload) {
        set({ submitting: true });
        try {
          const booking = await api('/bookings', { method: 'POST', body: JSON.stringify(payload) });
          set({ submitting: false });
          get().toast(`Booking confirmed at ${booking.hotel.name}`, 'success');
          get().loadHotels({ silent: true });
          get().refreshBookingViews();
          return booking;
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            return get().createLocalBooking(payload);
          }
          set({ submitting: false });
          get().toast(err.message, 'error');
          throw err;
        }
      },

      createLocalBooking(payload) {
        const hotel = localHotels.find((h) => h.id === payload.hotelId);
        const room = hotel?.rooms.find((r) => r.id === payload.roomId);
        if (!hotel || !room) {
          set({ submitting: false });
          get().toast('Room not found', 'error');
          throw new Error('Room not found');
        }
        const blocked = blockedRoomIds(hotel.id, get().localBookings, payload.checkIn, payload.checkOut);
        if (blocked.has(room.id)) {
          set({ submitting: false });
          const msg = `${room.name} is already booked for those dates — pick another room or different dates`;
          get().toast(msg, 'error');
          throw new Error(msg);
        }
        if (payload.guests > room.capacity) {
          set({ submitting: false });
          const msg = `${room.name} sleeps up to ${room.capacity} guest(s)`;
          get().toast(msg, 'error');
          throw new Error(msg);
        }
        const nights = nightsBetween(payload.checkIn, payload.checkOut);
        const booking = {
          ...payload,
          id: uid(),
          hotel,
          room,
          totalPrice: room.pricePerNight * nights,
          status: 'confirmed',
          paymentRef: `mock_pi_${uid().slice(0, 10)}`,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ localBookings: [booking, ...s.localBookings], submitting: false }));
        get().toast(`Booking confirmed at ${hotel.name} (saved locally)`, 'success');
        get().loadHotels({ silent: true });
        return booking;
      },

      async updateBooking(id, patch) {
        set({ submitting: true });
        try {
          await api(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
          set({ submitting: false });
          get().toast('Booking updated', 'success');
          get().refreshBookingViews();
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            set((s) => ({
              submitting: false,
              localBookings: s.localBookings.map((b) => {
                if (b.id !== id) return b;
                const merged = { ...b, ...patch };
                const nights = nightsBetween(merged.checkIn, merged.checkOut);
                merged.totalPrice = (merged.room?.pricePerNight ?? merged.hotel.pricePerNight) * nights;
                return merged;
              }),
            }));
            get().toast('Booking updated (saved locally)', 'success');
            get().refreshBookingViews();
          } else {
            set({ submitting: false });
            get().toast(err.message, 'error');
            throw err;
          }
        }
      },

      /** Refund/fee preview for cancelling a booking today. */
      async getCancellationQuote(id) {
        try {
          return await api(`/bookings/${id}/cancellation-quote`);
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            const booking = get().localBookings.find((b) => b.id === id);
            if (booking) return localCancellationQuote(booking);
          }
          throw err;
        }
      },

      /** Cancel under the policy; returns the cancelled booking. */
      async cancelBooking(id) {
        set({ submitting: true });
        try {
          const booking = await api(`/bookings/${id}/cancel`, { method: 'POST' });
          set({ submitting: false });
          get().toast(
            Number(booking.refundAmount) > 0
              ? `Cancelled — refund of ${new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(booking.refundAmount)} on its way`
              : 'Booking cancelled',
            'success',
          );
          get().refreshBookingViews();
          get().loadHotels({ silent: true });
          return booking;
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            const booking = get().localBookings.find((b) => b.id === id);
            const q = booking && localCancellationQuote(booking);
            if (!q || !q.cancellable) {
              set({ submitting: false });
              get().toast(q?.reason || 'Booking not found', 'error');
              throw new Error(q?.reason || 'not cancellable');
            }
            set((s) => ({
              submitting: false,
              localBookings: s.localBookings.map((b) =>
                b.id === id
                  ? { ...b, status: 'cancelled', cancelledAt: new Date().toISOString(),
                      cancellationFee: q.fee, refundAmount: q.refund, refundRef: `mock_re_local` }
                  : b,
              ),
            }));
            get().toast(`Cancelled — ${q.refund.toFixed(2)} CAD refunded (saved locally)`, 'success');
            get().refreshBookingViews();
            get().loadHotels({ silent: true });
            return get().localBookings.find((b) => b.id === id);
          }
          set({ submitting: false });
          get().toast(err.message, 'error');
          throw err;
        }
      },

      async deleteBooking(id) {
        try {
          await api(`/bookings/${id}`, { method: 'DELETE' });
          get().toast('Booking deleted', 'success');
          get().refreshBookingViews();
        } catch (err) {
          if (err instanceof ApiError && err.status === 0) {
            set((s) => ({ localBookings: s.localBookings.filter((b) => b.id !== id) }));
            get().toast('Booking deleted (local)', 'success');
            get().refreshBookingViews();
          } else {
            get().toast(err.message, 'error');
          }
        }
      },
    }),
    {
      name: 'wilderness-stays', // localStorage key — persists auth, filters & offline bookings
      partialize: (s) => ({
        filters: s.filters,
        localBookings: s.localBookings,
        token: s.token,
        user: s.user,
      }),
    },
  ),
);

/* Restore the auth header from persisted state on app boot. */
setAuthToken(useStore.getState().token);

/* Expired/invalid session → clean sign-out with a friendly prompt. */
setUnauthorizedHandler(() => {
  const { token, toast } = useStore.getState();
  if (!token) return;
  setAuthToken(null);
  useStore.setState({ token: null, user: null, myBookings: [] });
  toast('Your session expired — please sign in again', 'error');
});

/* Heal stale persisted dates: if the saved check-in is in the past,
   reset the range so searches and bookings start from valid dates. */
{
  const { filters } = useStore.getState();
  const today = todayISO();
  if (!filters.checkIn || filters.checkIn < today || filters.checkOut <= filters.checkIn) {
    useStore.setState({
      filters: { ...filters, checkIn: todayISO(1), checkOut: todayISO(3) },
    });
  }
}
