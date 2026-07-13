import { MS_PER_DAY, todayISO } from './dates';

/** Cancellation policy: free until 7 days before check-in, then a 70% fee. */
export const CANCEL_POLICY = { freeUntilDaysBefore: 7, lateFeePercent: 70 };

export function freeCancellationUntil(checkIn) {
  return new Date(Date.parse(checkIn) - CANCEL_POLICY.freeUntilDaysBefore * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Local mirror of the backend's cancellation quote (used in offline demo mode). */
export function localCancellationQuote(booking) {
  const daysUntilCheckIn = Math.round((Date.parse(booking.checkIn) - Date.parse(todayISO())) / MS_PER_DAY);
  const freeUntil = freeCancellationUntil(booking.checkIn);
  const total = Number(booking.totalPrice);

  if (booking.status === 'cancelled') {
    return { cancellable: false, reason: 'This booking is already cancelled', daysUntilCheckIn, feePercent: 0, fee: 0, refund: 0, freeCancellationUntil: freeUntil };
  }
  if (daysUntilCheckIn < 1) {
    return { cancellable: false, reason: 'Bookings cannot be cancelled on or after the check-in date', daysUntilCheckIn, feePercent: 0, fee: 0, refund: 0, freeCancellationUntil: freeUntil };
  }
  const feePercent = daysUntilCheckIn >= CANCEL_POLICY.freeUntilDaysBefore ? 0 : CANCEL_POLICY.lateFeePercent;
  const fee = Math.round(total * feePercent) / 100;
  return {
    cancellable: true,
    reason: null,
    daysUntilCheckIn,
    feePercent,
    fee,
    refund: Math.round((total - fee) * 100) / 100,
    freeCancellationUntil: freeUntil,
  };
}
