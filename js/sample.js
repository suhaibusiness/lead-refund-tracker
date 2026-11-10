// Made-up demo ledger for "Try it with sample leads". Every name and number is invented. Dates are placed relative
// to today so the claim deadlines are live.
import { addDays } from './rules.js';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const FIRST = ['Dana', 'Marcus', 'Priya', 'Glen', 'Rosa', 'Owen', 'Tess', 'Ali', 'June', 'Victor', 'Nora', 'Sam', 'Imani', 'Hector', 'Lena', 'Raj', 'Carla', 'Ben', 'Ivy', 'Theo', 'Maya', 'Luis', 'Grace', 'Omar'];
const LAST = ['W.', 'T.', 'N.', 'H.', 'A.', 'B.', 'K.', 'R.', 'M.', 'L.', 'S.', 'P.', 'D.', 'C.', 'F.', 'G.'];
const JOBS = { plumbing: ['Water heater repair', 'Drain cleaning', 'Leaking tap', 'Toilet replacement'], handyman: ['Fence repair', 'Door install', 'Drywall patch', 'TV mounting'] };

// [platform, count, outcome weights, value range, how the charge is set]
const PLAN = [
  ['angi', 26, { badcontact: 5, wrongservice: 4, outofarea: 3, noanswer: 6, quoted: 3, lost: 2, won: 3 }, [180, 650], { charge: [28, 46] }],
  ['thumbtack', 22, { badcontact: 2, duplicate: 1, noanswer: 6, spam: 1, quoted: 3, lost: 4, won: 5 }, [220, 900], { charge: [18, 34] }],
  ['lsa', 24, { spam: 2, noanswer: 3, wrongservice: 1, quoted: 4, lost: 4, won: 10 }, [400, 2400], { charge: [42, 78] }],
  ['bark', 14, { badcontact: 3, spam: 2, outofarea: 2, noanswer: 4, quoted: 2, lost: 1, won: 2 }, [200, 700], { credits: [6, 14] }],
  ['yelp', 6, { noanswer: 2, quoted: 2, won: 2 }, [300, 900], {}],
];

export function sampleData(today) {
  const r = rng(20261102);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const between = (a, b) => a + r() * (b - a);
  const leads = [];
  let n = 0;
  for (const [platform, count, weights, [vlo, vhi], cost] of PLAN) {
    const bag = Object.entries(weights).flatMap(([k, w]) => Array(w).fill(k));
    for (let i = 0; i < count; i++) {
      const age = Math.floor((i / count) * 115 + r() * 6); // spread over the last ~4 months
      const date = addDays(today, -age);
      let outcome = bag[Math.floor(r() * bag.length)];
      if (age < 3 && r() < 0.6) outcome = 'new';
      const lead = {
        id: 's' + (++n), platform, date, customer: `${pick(FIRST)} ${pick(LAST)}`,
        job: pick(r() < 0.5 ? JOBS.plumbing : JOBS.handyman), phone: `(512) 555-0${String(100 + Math.floor(r() * 899)).padStart(3, '0')}`,
        charge: cost.charge ? Math.round(between(...cost.charge)) : null, credits: cost.credits ? Math.round(between(...cost.credits)) : null,
        status: 'charged', outcome, value: null, note: '', claim: null, added: today,
      };
      if (platform === 'yelp') lead.status = '';
      if (outcome === 'won') lead.value = Math.round(between(vlo, vhi) / 10) * 10;
      leads.push(lead);
    }
  }
  // a duplicate the ledger should spot, and claims already sent or paid back
  const tt = leads.filter((l) => l.platform === 'thumbtack' && l.outcome === 'noanswer');
  if (tt.length) leads.push({ ...tt[tt.length - 1], id: 's' + (++n), date: addDays(tt[tt.length - 1].date, 2), outcome: 'duplicate' });
  const ag = leads.filter((l) => l.platform === 'angi' && l.date <= addDays(today, -20))[0];
  if (ag) leads.push({ ...ag, id: 's' + (++n), date: addDays(ag.date, 6), outcome: 'new', value: null });
  const tw = leads.find((l) => l.platform === 'thumbtack' && l.outcome === 'noanswer' && l.date >= addDays(today, -30));
  if (tw) tw.outcome = 'wrongservice';
  const old = leads.filter((l) => l.platform === 'angi' && l.outcome === 'badcontact').slice(-2);
  if (old[0]) old[0].claim = { state: 'won', on: addDays(old[0].date, 3), amount: old[0].charge };
  if (old[1]) old[1].claim = { state: 'sent', on: addDays(old[1].date, 1) };
  const settings = { business: 'Northside Home Services (sample)', ownerName: 'Sam', currency: '$', dateOrder: 'mdy', margin: 40,
    angiAnnual: false, creditPrice: { bark: 2.2 }, fees: { yelp: 450 } };
  return { leads, settings };
}
