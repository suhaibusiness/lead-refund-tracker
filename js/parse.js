// Reading lead and charge emails, CSV exports, dates and money. Nothing here guesses: a field we can't find, or
// find two different answers for, comes back empty with a note saying why.
export const PLATFORM_IDS = ['angi', 'thumbtack', 'lsa', 'bark', 'hipages', 'yelp', 'other'];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const real = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;
const year4 = (y) => (String(y).length === 2 ? 2000 + Number(y) : Number(y));
const monthOf = (s) => MONTHS.indexOf(String(s).slice(0, 3).toLowerCase()) + 1;

// Returns { date } or { options: [a, b] } (day-first vs month-first both possible) or null.
// order: 'auto' | 'dmy' | 'mdy'
export function parseDate(text, order = 'auto') {
  const s = String(text || '').trim();
  if (!s) return null;
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return real(+m[1], +m[2], +m[3]) ? { date: iso(+m[1], +m[2], +m[3]) } : null;
  // 6 Oct 2026, 6 October 2026, Mon, 6 Oct 2026 09:14:00 -0700
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (m && monthOf(m[2])) return real(+m[3], monthOf(m[2]), +m[1]) ? { date: iso(+m[3], monthOf(m[2]), +m[1]) } : null;
  // October 6, 2026 / Oct 6 2026
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && monthOf(m[1])) return real(+m[3], monthOf(m[1]), +m[2]) ? { date: iso(+m[3], monthOf(m[1]), +m[2]) } : null;
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) {
    const a = +m[1], b = +m[2], y = year4(m[3]);
    const dmy = real(y, b, a) ? iso(y, b, a) : null;
    const mdy = real(y, a, b) ? iso(y, a, b) : null;
    if (dmy && mdy && dmy !== mdy) {
      if (order === 'dmy') return { date: dmy };
      if (order === 'mdy') return { date: mdy };
      return { options: [dmy, mdy] };
    }
    return dmy || mdy ? { date: dmy || mdy } : null;
  }
  return null;
}

// "$1,234.50", "A$45", "45.00 AUD", "USD 12" -> number. Anything else -> null.
export function parseMoney(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  const m = s.match(/^(?:(?:AU|A|US|NZ)?\$|USD|AUD)?\s*(-?\d{1,3}(?:,\d{3})+|-?\d+)(\.\d{1,2})?\s*(?:AUD|USD|NZD)?$/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, '') + (m[2] || ''));
  return Number.isFinite(n) ? n : null;
}

const MONEY = String.raw`(?:(?:AU|A|US|NZ)?\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\s?\d+(?:\.\d{1,2})?)`;

export const digits = (s) => String(s || '').replace(/\D/g, '');

// --- splitting a paste into separate emails ---
export function splitEmails(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const starts = [];
  lines.forEach((l, i) => {
    if (!/^From:\s*\S/i.test(l)) return;
    const prev = lines.slice(0, i).reverse().find((x) => x.trim() !== '');
    if (i === 0 || (lines[i - 1].trim() === '' && !/forwarded message|original message/i.test(prev || ''))) starts.push(i);
  });
  if (starts.length === 0) return src.trim() ? [src.trim()] : [];
  const parts = [];
  if (lines.slice(0, starts[0]).join('\n').trim()) parts.push(lines.slice(0, starts[0]).join('\n').trim());
  starts.forEach((s, k) => parts.push(lines.slice(s, starts[k + 1] ?? lines.length).join('\n').trim()));
  return parts.filter(Boolean);
}

// --- one email ---
const DOMAINS = [
  ['angi', /@(?:[\w-]+\.)*angi\.com\b/i], ['thumbtack', /@(?:[\w-]+\.)*thumbtack\.com\b/i],
  ['bark', /@(?:[\w-]+\.)*bark\.com\b/i], ['hipages', /@(?:[\w-]+\.)*hipages\.com\.au\b/i],
  ['yelp', /@(?:[\w-]+\.)*yelp\.com\b/i],
];
const WORDS = [
  ['angi', /\bAngi\b/], ['thumbtack', /\bThumbtack\b/i], ['lsa', /\bLocal Services(?: Ads)?\b/i],
  ['bark', /\bBark(?:\.com)?\b/], ['hipages', /\bhipages\b/i], ['yelp', /\bYelp\b/i],
  // Footer and button text seen in real notifications (fixtures/real): Google's LSA lead emails, Yelp's lead page.
  ['lsa', /\bRespond to this lead in the app\b/i], ['yelp', /\bSend (?:price|an estimate) (?:&|and) availability\b/i],
];
const LABELS = {
  customer: ['customer name', 'customer', 'homeowner', 'client name', 'client', 'contact name', 'name'],
  job: ['service requested', 'service type', 'job type', 'type of work', 'project type', 'work needed', 'service', 'project', 'category', 'task', 'job', 'request'],
  phone: ['phone number', 'phone', 'mobile', 'tel', 'caller'],
  email: ['email address', 'email'],
  charge: ['amount charged', 'total charged', 'lead cost', 'lead price', 'lead fee', 'charged', 'charge', 'cost', 'price', 'amount', 'total'],
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function labelled(text, names) {
  const out = [];
  for (const n of names) {
    const re = new RegExp(`^[ \\t>*-]*${esc(n).replace(/ /g, '\\s+')}\\s*[:\\-–]\\s*([^\\n]*)`, 'gim'); // plain capture, trimmed in code: a lazy capture before \s*$ backtracks on long lines
    let m;
    while ((m = re.exec(text))) { const value = m[1].replace(/\*+/g, '').trim(); if (value) out.push({ label: n, value }); }
    // Label alone on its line, value on the next (Google LSA emails).
    const below = new RegExp(`^[ \\t>*-]*${esc(n).replace(/ /g, '\\s+')}[ \\t]*\\n[ \\t]*(\\S[^\\n]*)`, 'gim');
    while ((m = below.exec(text))) out.push({ label: n, value: m[1].replace(/\*+/g, '').trim() });
  }
  return out;
}
const uniq = (a) => [...new Set(a)];
// "We received this lead on Tue 4 Nov at 3pm." -> "Tue 4 Nov". Cut in code, not with a lazy regex, so a long line stays quick.
function receivedOn(body) {
  const line = (body.match(/\breceived this (?:request|lead|message|call) on ([^\n]*)/i) || [])[1] || '';
  let end = line.length;
  while (end > 1 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end--;
  if (end > 1 && line[end - 1] === '.') end--;
  const at = (line + '\n').search(/(?<=\S)\s+at\s/);
  return line.slice(0, at > 0 ? Math.min(at, end) : end);
}
// Stand-ins platforms print when they don't share the name (Google LSA: "Potential Customer").
const NO_NAME = /^(?:potential customer|customer|unknown|anonymous|n\/?a)$/i;

function headerBlock(chunk) {
  // For a forwarded email the original headers sit after the "Forwarded message" line.
  const fw = chunk.search(/(?<!-)-{2,}\s*(?:Forwarded message|Original Message)\s*-{2,}/i);
  const part = fw >= 0 ? chunk.slice(fw).replace(/^.*\n/, '') : chunk;
  const h = {};
  for (const line of part.split('\n')) {
    if (!line.trim()) { if (Object.keys(h).length) break; else continue; }
    const m = line.match(/^(From|Date|Subject|Sent|To):\s*(.*)$/i);
    if (m) { const k = m[1].toLowerCase() === 'sent' ? 'date' : m[1].toLowerCase(); if (!(k in h)) h[k] = m[2].trim(); }
    else if (Object.keys(h).length && !/^\s/.test(line) && !/^X-/i.test(line)) break;
  }
  return h;
}

export function detectPlatform(chunk, from = '') {
  for (const [id, re] of DOMAINS) if (re.test(from)) return { platform: id };
  if (/@google\.com\b/i.test(from) && /Local Services/i.test(chunk)) return { platform: 'lsa' };
  const hits = uniq(WORDS.filter(([, re]) => re.test(chunk)).map(([id]) => id));
  if (hits.length === 1) return { platform: hits[0] };
  if (hits.length > 1) return { platform: '', options: hits };
  return { platform: '' };
}

const NAME = String.raw`(?<![A-Za-z'’-])([A-Z][a-zA-Z'’-]+(?:[ \t]+[A-Z][a-zA-Z'’-]*\.?){0,2})`;
function customerFromText(text) {
  const pats = [
    new RegExp(String.raw`\b(?:new|a new)\s+(?:lead|request|job|message|enquiry|inquiry|quote request)\s+from\s+` + NAME),
    new RegExp(String.raw`\bcredits? (?:to|for) (?:contact|respond to)\s+` + NAME),
    new RegExp(String.raw`\b(?:lead|job|request) (?:with|for)\s+` + NAME + String.raw`\s+(?:has|was|is)\b`),
    new RegExp(NAME + String.raw`\s+(?:is looking for|wants|needs|requested|sent you a|called you|left you a)\b`),
  ];
  const found = [];
  for (const re of pats) { const m = text.match(re); if (m) found.push(m[1].trim().replace(/([a-z]{2,})\.$/i, '$1')); } // drop a full stop after a whole word
  return uniq(found).filter((n) => !/^(?:You|Your|We|The|This|A|Hi|Hello|New|Lead|Customer|Potential|Someone|Somebody|Anyone|Homeowner|Caller|Client)\b/.test(n));
}

// Returns { kind, fields, missing, notes, options } for one email.
export function parseEmail(chunk, opts = {}) {
  const text = String(chunk || '').replace(/\r\n?/g, '\n');
  const h = headerBlock(text);
  const body = text;
  const notes = [], options = {}, f = { platform: '', date: '', customer: '', job: '', phone: '', email: '', charge: null, credits: null, status: '' };

  const p = detectPlatform(body, h.from || '');
  f.platform = p.platform;
  if (p.options) { options.platform = p.options; notes.push(`Mentions more than one platform (${p.options.join(', ')}).`); }

  const dateSrc = h.date || (labelled(body, ['date received', 'received', 'lead date', 'lead created', 'date'])[0] || {}).value
    || receivedOn(body);
  const d = parseDate(dateSrc, opts.dateOrder);
  if (d && d.date) f.date = d.date;
  else if (d && d.options) { options.date = d.options; notes.push(`"${dateSrc}" could be day-first or month-first.`); }

  const subj = h.subject || '';
  const cust = uniq(labelled(body, LABELS.customer).filter((x) => !/@/.test(x.value) && !NO_NAME.test(x.value)).map((x) => x.value));
  const custAll = cust.length ? cust : customerFromText(subj + '\n' + body);
  if (custAll.length === 1) f.customer = custAll[0];
  else if (custAll.length > 1) { options.customer = custAll; notes.push('Found more than one customer name.'); }

  const jobs = uniq(labelled(body, LABELS.job).map((x) => x.value));
  if (jobs.length === 1) f.job = jobs[0];
  else if (jobs.length > 1) f.job = jobs[0], notes.push(`Several job lines; used "${jobs[0]}".`);

  const phones = uniq(labelled(body, LABELS.phone).map((x) => x.value).filter((v) => digits(v).length >= 8));
  if (phones.length) f.phone = phones[0];
  const emails = uniq(labelled(body, LABELS.email).map((x) => x.value).filter((v) => /@/.test(v)));
  if (emails.length) f.email = emails[0];

  // Money: labelled amounts and "charged $X" phrases only. One distinct value -> use it; several -> ask.
  const isRefund = /\b(?:refund(?:ed)?\b|lead credit (?:approved|issued)|credit (?:has been|was) (?:approved|issued|applied)|credits? (?:have been |were )?returned)/i.test(subj + '\n' + body);
  const amounts = [];
  for (const x of labelled(body, LABELS.charge.concat(isRefund ? ['refund', 'refund amount', 'credit amount', 'credited'] : []))) {
    for (const mm of x.value.matchAll(new RegExp(MONEY, 'g'))) amounts.push(parseMoney(mm[0].replace(/\s/g, '')));
  }
  const phr = new RegExp(String.raw`\b(?:charged(?: you)?|you paid|cost you|refund(?:ed)?(?: of)?|credited(?: back)?(?: with)?)\s+(` + MONEY + ')', 'gi');
  let pm; while ((pm = phr.exec(body))) amounts.push(parseMoney(pm[1].replace(/\s/g, '')));
  const vals = uniq(amounts.filter((v) => v !== null));
  if (vals.length === 1) f.charge = vals[0];
  else if (vals.length > 1) { options.charge = vals; notes.push('Found more than one amount.'); }

  const cr = [];
  const crRe = /\b(?:used|spent|cost|costs|for|returned|charged)[ \t]+(\d{1,3})[ \t]+credits?\b|\bcredits?[ \t]*(?:(?:used|spent|charged)[ \t]*)?[:\-–][ \t]*(\d{1,3})\b|\b(\d{1,3})[ \t]+credits?[ \t]+(?:to|were|have been|has been|used|spent)\b/gi;
  let cm; while ((cm = crRe.exec(body))) cr.push(Number(cm[1] || cm[2] || cm[3]));
  const crv = uniq(cr);
  if (crv.length === 1) f.credits = crv[0];
  else if (crv.length > 1) { options.credits = crv; notes.push('Found more than one credit count.'); }

  if (isRefund) f.status = 'credited';
  else if (/\bmissed call\b/i.test(body)) f.status = 'missed call';
  else if (/\b(?:not charged|no charge|free lead|won['’]t be charged)\b/i.test(body)) f.status = 'not charged';
  else if (f.charge !== null || f.credits !== null || /\bcharged\b/i.test(body)) f.status = 'charged';

  const kind = isRefund ? 'refund' : 'lead';
  const need = kind === 'refund' ? ['platform', 'date', 'customer', 'charge'] : ['platform', 'date', 'customer', 'job', 'charge'];
  if (f.platform === 'yelp') need.splice(need.indexOf('charge'), 1); // Yelp bills ad clicks, not leads
  const missing = need.filter((k) => {
    if (k === 'charge') return f.charge === null && f.credits === null && !options.charge && !options.credits;
    return !f[k] && !options[k];
  });
  return { kind, fields: f, missing, notes, options };
}

export const parseEmails = (text, opts) => splitEmails(text).map((c) => ({ raw: c, ...parseEmail(c, opts) }));

// --- CSV ---
export function parseCSV(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const CSV_SYNONYMS = {
  date: ['lead date', 'date received', 'received', 'created', 'created at', 'date', 'lead created'],
  platform: ['platform', 'source', 'lead source', 'channel'],
  customer: ['customer name', 'customer', 'homeowner', 'client', 'name', 'contact', 'consumer'],
  job: ['job type', 'service', 'category', 'project', 'task', 'job', 'request'],
  phone: ['phone', 'phone number', 'mobile', 'caller'],
  charge: ['lead cost', 'charge', 'charged', 'amount', 'cost', 'price', 'lead price', 'fee'],
  credits: ['credits', 'credits used', 'credit'],
  status: ['charge status', 'status', 'lead status'],
  outcome: ['outcome', 'result'],
  value: ['job value', 'value', 'revenue', 'sale'],
};
export const CSV_FIELDS = Object.keys(CSV_SYNONYMS);
const norm = (h) => String(h).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function guessColumns(headers) {
  const map = {}; const used = new Set();
  for (const f of CSV_FIELDS) {
    for (const syn of CSV_SYNONYMS[f]) {
      const i = headers.findIndex((h, k) => !used.has(k) && norm(h) === syn);
      if (i >= 0) { map[f] = i; used.add(i); break; }
    }
  }
  return map;
}

const OUTCOME_WORDS = [
  ['won', /\b(?:won|hired|booked|sold)\b/i], ['lost', /\blost\b/i], ['quoted', /\b(?:quoted|estimate sent|quote sent)\b/i],
  ['spam', /\b(?:spam|fake|fraud|bot)\b/i], ['duplicate', /\bduplicate\b/i], ['badcontact', /\b(?:wrong number|bad number|invalid (?:phone|number|contact|email)|disconnected)\b/i],
  ['outofarea', /\b(?:out of (?:area|range)|outside (?:area|service area))\b/i], ['wrongservice', /\b(?:wrong (?:service|job|category)|not a service)\b/i],
  ['noanswer', /\b(?:no answer|no response|unresponsive|never replied)\b/i],
];
export const outcomeFromText = (s) => (OUTCOME_WORDS.find(([, re]) => re.test(String(s || ''))) || [''])[0];

export function platformFromText(s) {
  const t = String(s || '').toLowerCase();
  if (!t) return '';
  if (/angi|angie/.test(t)) return 'angi';
  if (/thumbtack/.test(t)) return 'thumbtack';
  if (/local services|\blsa\b|google/.test(t)) return 'lsa';
  if (/\bbark\b/.test(t)) return 'bark';
  if (/hipages/.test(t)) return 'hipages';
  if (/yelp/.test(t)) return 'yelp';
  return '';
}

// rows of strings -> leads + problems. platform: fixed platform id for the file, or '' to read the column.
export function rowsToLeads(rows, map, { platform = '', dateOrder = 'auto' } = {}) {
  const leads = [], problems = [];
  rows.forEach((r, i) => {
    const get = (k) => (map[k] !== undefined && map[k] !== '' ? String(r[map[k]] ?? '').trim() : '');
    const why = [];
    const pf = platform || platformFromText(get('platform'));
    if (!pf) why.push('no platform');
    const d = parseDate(get('date'), dateOrder);
    if (!d) why.push(get('date') ? `date "${get('date')}" not readable` : 'no date');
    else if (d.options) why.push(`date "${get('date')}" could be day-first or month-first`);
    const rawCharge = get('charge');
    const charge = rawCharge ? parseMoney(rawCharge) : null;
    if (rawCharge && charge === null) why.push(`amount "${rawCharge}" not readable`);
    const rawCr = get('credits');
    const credits = rawCr && /^\d+$/.test(rawCr) ? Number(rawCr) : null;
    if (rawCr && credits === null) why.push(`credits "${rawCr}" not readable`);
    const rawVal = get('value');
    const value = rawVal ? parseMoney(rawVal) : null;
    if (rawVal && value === null) why.push(`job value "${rawVal}" not readable`);
    const lead = { platform: pf, date: d && d.date ? d.date : '', customer: get('customer'), job: get('job'), phone: get('phone'),
      charge, credits, status: get('status'), outcome: outcomeFromText(get('outcome')) || 'new', value };
    if (why.length) problems.push({ row: i + 2, why, lead }); else leads.push(lead);
  });
  return { leads, problems };
}
