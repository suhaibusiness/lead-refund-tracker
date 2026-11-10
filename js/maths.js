// Lead maths per platform and month, and the plain keep / cut / renegotiate read.
// The read compares the gross profit from won jobs with what the leads cost, the LTGP-to-CAC idea in Hormozi's
// $100M Leads ("Run Paid Ads Part II: Money Stuff", p. 220 of the PDF): profit below cost means losing money, and
// businesses that struggle to scale had a ratio under 3 to 1 ("a pattern I personally observed, not a rule").
// We count only the first job's gross profit, so the read errs on the side of caution.
export const MIN_DECIDED = 10;

const monthKey = (d) => d.slice(0, 7);
export function monthsBetween(a, b) {
  const out = []; let y = +a.slice(0, 4), m = +a.slice(5, 7);
  const ey = +b.slice(0, 4), em = +b.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// What one lead cost in money, or null when we can't know (credits with no price per credit set).
export function leadCost(lead, settings = {}) {
  if (lead.charge !== null && lead.charge !== undefined && lead.charge !== '') return Number(lead.charge);
  if (lead.credits) {
    const p = Number((settings.creditPrice || {})[lead.platform]);
    return p > 0 ? lead.credits * p : null;
  }
  return null;
}
const QUOTED = new Set(['quoted', 'lost', 'won']);

function blank() { return { leads: 0, decided: 0, unsorted: 0, unknownCost: 0, leadSpend: 0, fees: 0, credited: 0, quotes: 0, won: 0, value: 0, wonNoValue: 0 }; }
function finish(t, margin) {
  t.spend = t.leadSpend + t.fees;
  t.net = Math.max(0, t.spend - t.credited);
  const div = (a, b) => (b > 0 ? a / b : null);
  t.cpl = div(t.net, t.leads); t.cpq = div(t.net, t.quotes); t.cpw = div(t.net, t.won);
  t.roas = div(t.value, t.net);
  t.gp = margin > 0 ? t.value * margin / 100 : null;
  t.gpRatio = t.gp !== null ? div(t.gp, t.net) : null;
  return t;
}

// leads in, { platforms: { id: { months: [{ month, ...stats }], total } } } out. months: optional [from, to] 'YYYY-MM'.
export function computeStats(leads, settings = {}, range = null) {
  const margin = Number(settings.margin) || 0;
  const fees = settings.fees || {};
  const dated = leads.filter((l) => l.date && l.platform);
  if (!dated.length) return { platforms: {} };
  const lastAll = dated.map((l) => monthKey(l.date)).sort().pop();
  const out = { platforms: {} };
  const ids = [...new Set(dated.map((l) => l.platform))];
  for (const id of ids) {
    const mine = dated.filter((l) => l.platform === id);
    const first = mine.map((l) => monthKey(l.date)).sort()[0];
    let months = monthsBetween(first, lastAll);
    if (range) months = months.filter((m) => m >= range[0] && m <= range[1]);
    if (!months.length) continue;
    const rows = months.map((month) => {
      const t = blank(); t.month = month;
      t.fees = Number(fees[id]) > 0 ? Number(fees[id]) : 0;
      for (const l of mine.filter((x) => monthKey(x.date) === month)) {
        t.leads++;
        if (l.outcome && l.outcome !== 'new') t.decided++; else t.unsorted++;
        const c = leadCost(l, settings);
        if (c === null) { if (!(id === 'yelp' && !l.credits)) t.unknownCost++; } else t.leadSpend += c;
        if (l.claim && l.claim.state === 'won' && Number(l.claim.amount) > 0) t.credited += Number(l.claim.amount);
        if (QUOTED.has(l.outcome)) t.quotes++;
        if (l.outcome === 'won') { t.won++; if (Number(l.value) > 0) t.value += Number(l.value); else t.wonNoValue++; }
      }
      return finish(t, margin);
    });
    const total = blank();
    for (const r of rows) for (const k of Object.keys(total)) total[k] += r[k];
    out.platforms[id] = { months: rows, total: finish(total, margin) };
  }
  return out;
}

const r1 = (n) => (Math.round(n * 10) / 10).toString();
// The plain read for one platform's totals.
export function readFor(t, settings = {}) {
  const cur = settings.currency || '$';
  const margin = Number(settings.margin) || 0;
  if (t.spend <= 0) return { verdict: 'nocost', title: 'Add what it costs', why: 'There’s no spend recorded yet. Add the lead charges, a price per credit, or the monthly fee in Settings.' };
  if (t.decided < MIN_DECIDED) return { verdict: 'early', title: 'Too early to call', why: `Only ${t.decided} lead${t.decided === 1 ? ' has' : 's have'} an outcome. Sort at least ${MIN_DECIDED} to get a fair read.` };
  if (t.value < t.net) return { verdict: 'cut', title: 'Cut', why: t.value > 0 ? `Every ${cur}1 spent brought back ${cur}${(t.value / t.net).toFixed(2)} of work. That’s less than it cost, before you pay for materials or wages.` : 'You haven’t won a paid job from these leads yet, so everything spent here is gone.' };
  if (!margin) return { verdict: 'margin', title: 'Add your margin', why: `The jobs won are worth ${r1(t.value / t.net)}× what the leads cost. Add your usual gross margin in Settings to see if that’s profit.` };
  const g = t.gp / t.net;
  if (g < 1) return { verdict: 'cut', title: 'Cut', why: `After job costs, you keep ${cur}${g.toFixed(2)} for every ${cur}1 spent on leads. You’re paying to work.` };
  if (g < 3) return { verdict: 'renegotiate', title: 'Renegotiate', why: `You keep ${cur}${g.toFixed(2)} of profit for every ${cur}1 spent. That pays, but thinly. Before renewing, push for a lower price, tighter filters or monthly terms, and claim back the junk.` };
  return { verdict: 'keep', title: 'Keep', why: `You keep ${cur}${g.toFixed(2)} of profit for every ${cur}1 spent on these leads. That’s at or above the 3 to 1 mark.` };
}
