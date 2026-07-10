export const MS_PER_DAY = 86400000;

export const todayISO = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * MS_PER_DAY).toISOString().slice(0, 10);

export const nightsBetween = (checkIn, checkOut) =>
  Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / MS_PER_DAY);

export const rangesOverlap = (aIn, aOut, bIn, bOut) => aIn < bOut && aOut > bIn;

export const formatDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

export const formatMoney = (n) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n));
