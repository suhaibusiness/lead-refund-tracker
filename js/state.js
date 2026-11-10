// The ledger as read back from this browser or from an exported file.
import { PLATFORMS, OUTCOMES } from './rules.js';

export const DEFAULTS = { business: '', ownerName: '', currency: '$', dateOrder: 'auto', margin: '', angiAnnual: false, creditPrice: {}, fees: {} };
export const CURRENCIES = ['$', 'A$', '£', '€'];

// An exported file can come from anyone (and this browser's storage is shared with the other tools on the same site),
// so every value is reshaped to the type the app writes, and every choice to one the app offers. Nothing read back can
// then reach the page as markup or stop the app.
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const one = (v, ok, d) => (ok.includes(v) ? v : d);
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const PLAT_IDS = Object.keys(PLATFORMS), OUTCOME_IDS = OUTCOMES.map(([k]) => k);
const prices = (o) => (isObj(o) ? Object.fromEntries(Object.entries(o).filter(([k, v]) => PLAT_IDS.includes(k) && (v === '' || numOrNull(v) !== null))) : {});
function claim(c) {
  if (!isObj(c) || !['sent', 'won', 'denied'].includes(c.state)) return null;
  const out = { state: c.state, on: day(c.on) };
  if ('amount' in c) out.amount = numOrNull(c.amount);
  return out;
}
const FIELDS = {
  id: (v) => (typeof v === 'string' && v ? v : null), platform: (v) => one(v, PLAT_IDS, 'other'), date: day,
  customer: text, job: text, phone: text, charge: numOrNull, credits: numOrNull, status: text, outcome: (v) => one(v, OUTCOME_IDS, 'new'),
  value: numOrNull, note: text, claim, added: day, draft: (v) => (typeof v === 'string' ? v : undefined),
};
function lead(l, i) {
  const out = {};
  for (const [k, v] of Object.entries(l)) if (FIELDS[k]) { const x = FIELDS[k](v); if (x !== undefined) out[k] = x; }
  for (const k of ['id', 'platform', 'date', 'customer', 'job', 'phone', 'charge', 'credits', 'status', 'outcome', 'value', 'note', 'claim']) if (!(k in out)) out[k] = FIELDS[k](undefined);
  if (!out.id) out.id = 'imported-' + i;
  return out;
}

// d: parsed JSON. Returns { leads, settings }, or null when it isn't a ledger.
export function openState(d) {
  if (!d || !Array.isArray(d.leads)) return null;
  const s = isObj(d.settings) ? d.settings : {};
  const settings = { business: text(s.business), ownerName: text(s.ownerName), currency: one(s.currency, CURRENCIES, '$'),
    dateOrder: one(s.dateOrder, ['auto', 'dmy', 'mdy'], 'auto'), margin: s.margin === '' ? '' : numOrNull(s.margin) ?? '',
    angiAnnual: s.angiAnnual === true, creditPrice: prices(s.creditPrice), fees: prices(s.fees) };
  return { leads: d.leads.filter(isObj).map(lead), settings };
}
