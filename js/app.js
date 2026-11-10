// Lead Refund Tracker app: routing, views and storage. Everything stays in this browser (localStorage).
import * as P from './parse.js';
import * as R from './rules.js';
import * as M from './maths.js';
import { sampleData } from './sample.js';
import { DEFAULTS, openState } from './state.js';

const KEY = 'lead-ledger-v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const PLAT_IDS = Object.keys(R.PLATFORMS);

let state = load();
const ui = { addMode: 'emails', paste: '', pending: null, csv: null, editing: null, filter: { q: '', platform: '', outcome: '' }, shown: 60, period: 'all', receive: null };

function load() {
  try {
    const d = openState(JSON.parse(localStorage.getItem(KEY) || 'null'));
    if (d) return d;
  } catch (e) {}
  return { leads: [], settings: { ...DEFAULTS } };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Couldn’t save in this browser. Export your data to keep it.'); } }

function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.remove(), 3200);
}

const cur = () => state.settings.currency || '$';
const money = (n) => R.money(n, cur());
function shortDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00Z');
  const sameYear = s.slice(0, 4) === todayISO().slice(0, 4);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}
const chip = (p) => `<span class="chip p-${esc(p)}">${esc((R.PLATFORMS[p] || R.PLATFORMS.other).short)}</span>`;
const days = (n) => (n === 0 ? 'last day today' : n === 1 ? '1 day left' : `${n} days left`);
const costText = (l) => { const c = M.leadCost(l, state.settings); return c !== null ? money(c) : (l.credits ? `${l.credits} credits` : ''); };

// ---------- claim tags ----------
function claimTag(l, c) {
  if (!c) return '';
  if (c.status === 'tracked') {
    const k = l.claim.state;
    if (k === 'won') return `<span class="tag ok">Got ${Number(l.claim.amount) > 0 ? money(Number(l.claim.amount)) : 'it'} back</span>`;
    if (k === 'denied') return '<span class="tag mute">Claim denied</span>';
    return `<span class="tag info">${l.platform === 'lsa' ? 'Rated on Google' : 'Claim sent'}</span>`;
  }
  if (c.status === 'claim') return `<span class="tag claim">Claim by ${shortDate(c.deadline)}</span>`;
  if (c.status === 'check') return `<span class="tag check">Maybe: claim by ${shortDate(c.deadline)}</span>`;
  if (c.status === 'feedback') return '<span class="tag info">Rate it on Google</span>';
  if (c.status === 'auto') return '<span class="tag info">May refund itself</span>';
  if (c.status === 'late') return '<span class="tag mute">Too late to claim</span>';
  if (c.status === 'blocked') return '<span class="tag mute">No credits on annual plan</span>';
  if (c.status === 'unconfirmed' && R.JUNK.includes(l.outcome)) return '<span class="tag mute">Rule unconfirmed</span>';
  if (c.status === 'none' && R.JUNK.includes(l.outcome)) return '<span class="tag mute">No claim route</span>';
  return '';
}
const claimOf = (l) => R.claimFor(l, state.settings, todayISO());
const openClaims = () => state.leads.map((l) => ({ l, c: claimOf(l) })).filter(({ c }) => c && (c.status === 'claim' || c.status === 'check'));

// ---------- router ----------
const VIEWS = { ledger: viewLedger, add: viewAdd, claims: viewClaims, maths: viewMaths, rules: viewRules, settings: viewSettings };
function route() { const r = (location.hash.match(/^#\/(\w+)/) || [])[1]; return Object.hasOwn(VIEWS, r) ? r : 'ledger'; }
function render() {
  const r = route();
  document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.tab === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const n = openClaims().length;
  const b = $('#claim-badge'); b.textContent = n; b.classList.toggle('hidden', !n); b.setAttribute('aria-label', `${n} to claim`);
  $('#view').innerHTML = VIEWS[r]();
  document.title = { ledger: 'Ledger', add: 'Add leads', claims: 'Claims', maths: 'Lead maths', rules: 'Rules', settings: 'Settings' }[r] + ': Lead Refund Tracker';
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ---------- ledger ----------
function viewLedger() {
  if (!state.leads.length) return welcome();
  const f = ui.filter;
  const dupes = R.duplicateOf(state.leads);
  let list = state.leads.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (f.platform) list = list.filter((l) => l.platform === f.platform);
  if (f.outcome === 'new') list = list.filter((l) => !l.outcome || l.outcome === 'new');
  else if (f.outcome === 'junk') list = list.filter((l) => R.JUNK.includes(l.outcome));
  else if (f.outcome === 'claim') list = list.filter((l) => { const c = claimOf(l); return c && ['claim', 'check'].includes(c.status); });
  else if (f.outcome) list = list.filter((l) => l.outcome === f.outcome);
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter((l) => [l.customer, l.job, l.phone, l.note].join(' ').toLowerCase().includes(q)); }
  const unsorted = state.leads.filter((l) => !l.outcome || l.outcome === 'new').length;
  const spent = state.leads.reduce((s, l) => s + (M.leadCost(l, state.settings) || 0), 0);
  const plats = [...new Set(state.leads.map((l) => l.platform))];
  return `<div class="section-head"><div><h1>Your leads</h1>
    <p class="muted">${state.leads.length} lead${state.leads.length === 1 ? '' : 's'} · ${money(spent)} in lead charges${unsorted ? ` · <strong>${unsorted} still to sort</strong>` : ''}</p></div>
    <a class="btn primary" href="#/add">Add leads</a></div>
  <div class="toolbar">
    <div class="search"><label class="sr-only" for="f-q">Search</label><input type="search" id="f-q" placeholder="Search name, job, phone or note" value="${esc(f.q)}"></div>
    <div><label class="sr-only" for="f-platform">Platform</label><select id="f-platform"><option value="">All platforms</option>${plats.map((p) => `<option value="${p}" ${f.platform === p ? 'selected' : ''}>${esc(R.PLATFORMS[p].name)}</option>`).join('')}</select></div>
    <div><label class="sr-only" for="f-outcome">Outcome</label><select id="f-outcome">
      ${[['', 'Every outcome'], ['new', 'Still to sort'], ['claim', 'Can claim back'], ['junk', 'Any junk lead'], ...R.OUTCOMES.filter(([k]) => k !== 'new')].map(([k, v]) => `<option value="${k}" ${f.outcome === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}
    </select></div>
  </div>
  ${list.length ? `<ul class="leads" id="lead-list">${list.slice(0, ui.shown).map((l) => leadRow(l, dupes)).join('')}</ul>` : '<p class="card muted">No leads match. Clear the search or filters.</p>'}
  ${list.length > ui.shown ? `<p class="more"><button class="btn" data-act="more">Show more (${list.length - ui.shown} left)</button></p>` : ''}`;
}

function leadRow(l, dupes = {}) {
  const c = claimOf(l);
  const dupeOf = dupes[l.id] && l.outcome !== 'duplicate' ? state.leads.find((x) => x.id === dupes[l.id]) : null;
  const opts = R.OUTCOMES.map(([k, v]) => `<option value="${k}" ${(l.outcome || 'new') === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  return `<li class="lead" data-id="${esc(l.id)}">
    <div class="who"><strong>${esc(l.customer || 'No name')}</strong> ${chip(l.platform)}
      <div class="meta"><span>${esc(l.job || 'Job not given')}</span><span>${shortDate(l.date)}</span>${l.status && l.status !== 'charged' ? `<span>${esc(l.status)}</span>` : ''}${costText(l) ? `<span class="num">${esc(costText(l))}</span>` : ''}${claimTag(l, c)}
      ${dupeOf ? `<span class="dupe">Same customer as the ${shortDate(dupeOf.date)} lead</span><button class="btn sm" data-act="mark-dupe">Mark duplicate</button>` : ''}</div></div>
    <div><label class="sr-only" for="o-${esc(l.id)}">Outcome for ${esc(l.customer || 'this lead')}</label>
      <select id="o-${esc(l.id)}" data-f="outcome" class="o-${esc(l.outcome || 'new')}">${opts}</select></div>
    <div class="value">${l.outcome === 'won' ? `<label class="sr-only" for="v-${esc(l.id)}">Job value</label><input type="number" inputmode="decimal" min="0" step="any" id="v-${esc(l.id)}" data-f="value" placeholder="Job value ${esc(cur())}" value="${l.value ?? ''}">` : ''}</div>
    <div class="acts"><button class="btn sm ghost" data-act="edit" aria-expanded="${ui.editing === l.id}">${ui.editing === l.id ? 'Close' : 'Edit'}</button></div>
    ${ui.editing === l.id ? editForm(l) : ''}
  </li>`;
}

function leadFields(l, prefix) {
  const v = (k) => esc(l[k] ?? '');
  return `<div class="grid2">
    <div class="field"><label for="${prefix}platform">Platform</label><select id="${prefix}platform" name="platform" required>${PLAT_IDS.map((p) => `<option value="${p}" ${l.platform === p ? 'selected' : ''}>${esc(R.PLATFORMS[p].name)}</option>`).join('')}</select></div>
    <div class="field"><label for="${prefix}date">Date you got the lead</label><input type="date" id="${prefix}date" name="date" value="${v('date')}" required></div>
    <div class="field"><label for="${prefix}customer">Customer</label><input type="text" id="${prefix}customer" name="customer" value="${v('customer')}"></div>
    <div class="field"><label for="${prefix}job">Job</label><input type="text" id="${prefix}job" name="job" value="${v('job')}"></div>
    <div class="field"><label for="${prefix}phone">Phone</label><input type="tel" id="${prefix}phone" name="phone" value="${v('phone')}"></div>
    <div class="field"><label for="${prefix}charge">Charge (${esc(cur())})</label><input type="number" inputmode="decimal" step="any" min="0" id="${prefix}charge" name="charge" value="${v('charge')}"></div>
    <div class="field"><label for="${prefix}credits">Or credits used</label><input type="number" inputmode="numeric" step="1" min="0" id="${prefix}credits" name="credits" value="${v('credits')}"><div class="hint">For Bark and hipages.</div></div>
  </div>
  <div class="field"><label for="${prefix}note">Note <span class="muted small">(goes into the claim text)</span></label><textarea class="prose" rows="2" id="${prefix}note" name="note">${v('note')}</textarea></div>`;
}
function editForm(l) {
  return `<form class="edit" data-edit="${esc(l.id)}">${leadFields(l, 'e-')}
    <div class="row"><button class="btn primary" type="submit">Save changes</button><button class="btn" type="button" data-act="edit">Cancel</button>
    <button class="btn danger ghost" type="button" data-act="delete" style="margin-left:auto">Delete lead</button></div></form>`;
}
function readLeadForm(form) {
  const d = Object.fromEntries(new FormData(form));
  const num = (x) => (x === '' || x === undefined ? null : Number(x));
  return { platform: d.platform, date: d.date, customer: d.customer.trim(), job: d.job.trim(), phone: d.phone.trim(),
    charge: num(d.charge), credits: num(d.credits), note: d.note.trim() };
}

function welcome() {
  return `<section class="welcome card" style="padding:28px">
    <div><h1>Every paid lead in one place. And the ones you can claim back.</h1>
      <p class="intro">Paste the lead and charge emails from Angi, Thumbtack, Google Local Services, Bark, hipages or Yelp. Mark what happened to each one. Lead Refund Tracker checks each platform’s own written rules, tells you which leads you can still claim back and by when, writes the claim for you, and shows what a won job really costs before you renew.</p>
      <p class="privacy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg><span>No account. Your leads stay in this browser, and you send every claim yourself.</span></p></div>
    <div class="starts">
      <a class="btn primary lg" href="#/add" data-mode="emails">Paste lead emails</a>
      <a class="btn lg" href="#/add" data-mode="csv">Import a CSV export</a>
      <a class="btn lg" href="#/add" data-mode="manual">Add one by hand</a>
      <button class="btn lg ghost" data-act="sample">Try it with sample leads</button>
    </div></section>`;
}

// ---------- add ----------
function viewAdd() {
  const m = ui.addMode;
  const seg = [['emails', 'Paste emails'], ['csv', 'Import CSV'], ['manual', 'Add by hand']].map(([k, v]) => `<button type="button" data-mode="${k}" aria-pressed="${m === k}">${v}</button>`).join('');
  let body = '';
  if (m === 'emails') body = `<div class="card"><label for="paste">Paste one or more lead, charge or refund emails</label>
      <textarea id="paste" rows="10" placeholder="From: Angi Leads &lt;leads@angi.com&gt;&#10;Date: Tue, 20 Oct 2026 08:41&#10;Subject: New lead from Dana Whitfield&#10;&#10;Customer: Dana Whitfield&#10;Service: Fence Repair&#10;Lead cost: $38.50">${esc(ui.paste)}</textarea>
      <p class="hint">Paste whole emails, headers included if you can. Start each one with its “From:” line and we’ll split them. Anything we can’t read is shown to you, not guessed.</p>
      <div class="row"><button class="btn primary" data-act="read-emails">Read these emails</button><button class="btn" data-act="sample-emails">Use the sample emails</button></div></div>
      ${ui.pending ? reviewHtml() : ''}`;
  else if (m === 'csv') body = csvHtml();
  else body = `<form class="card" id="manual-form"><h2>Add a lead by hand</h2>${leadFields({ platform: 'angi', date: todayISO() }, 'm-')}
      <div class="row"><button class="btn primary" type="submit">Add to the ledger</button></div></form>`;
  return `<div class="section-head"><div><h1>Add leads</h1><p class="muted">Bring them in however is quickest. You can fix anything afterwards.</p></div></div>
    <div class="seg" role="group" aria-label="How to add" style="margin-bottom:14px">${seg}</div>${body}`;
}

const FIELD_LABEL = { platform: 'Platform', date: 'Date', customer: 'Customer', job: 'Job', phone: 'Phone', charge: `Charge (${'$'})`, credits: 'Credits' };
function matchLead(f) {
  const key = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  return state.leads.filter((l) => l.platform === f.platform && key(l.customer) && key(l.customer) === key(f.customer))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}
// Already in the ledger: same platform and day, and no known field disagrees (a field you filled in by hand doesn't count against it).
const alreadyIn = (f) => !!f.platform && !!f.date && state.leads.some((l) => {
  const both = (a, b) => a !== null && a !== undefined && a !== '' && b !== null && b !== undefined && b !== '';
  const differ = (a, b) => both(a, b) && String(a).toLowerCase().trim() !== String(b).toLowerCase().trim();
  return l.platform === f.platform && l.date === f.date && !['customer', 'job', 'phone', 'charge', 'credits'].some((k) => differ(l[k], f[k]));
});

function reviewHtml() {
  const items = ui.pending.items;
  if (!items.length) return '<div class="notice warn">There was nothing to read in that paste.</div>';
  const n = items.filter((x) => x.include).length;
  return `<h2 style="margin-top:22px">Check what we found</h2>
    <p class="muted">Red boxes are things we couldn’t find. Fill them in or leave them blank; untick anything you don’t want.</p>
    <div class="review">${items.map((it, i) => reviewItem(it, i)).join('')}</div>
    <div class="row end" style="margin-top:14px"><button class="btn" data-act="clear-pending">Start again</button><button class="btn primary" data-act="add-pending" ${n ? '' : 'disabled'}>Add ${n} to the ledger</button></div>`;
}
function reviewItem(it, i) {
  const f = it.fields;
  const cell = (k, input) => {
    const miss = (it.missing.includes(k) || it.options[k]) && (f[k] === '' || f[k] === null || f[k] === undefined);
    const opts = it.options[k] ? `<div class="opts">${it.options[k].map((o) => `<button type="button" class="btn sm" data-pick="${i}" data-k="${k}" data-v="${esc(o)}">${esc(k === 'charge' ? money(o) : k === 'date' ? R.longDate(o) : k === 'platform' ? R.PLATFORMS[o].short : o)}</button>`).join('')}</div>` : '';
    return `<div class="${miss ? 'miss' : ''}"><label for="r${i}-${k}">${k === 'charge' ? `Charge (${esc(cur())})` : FIELD_LABEL[k]}</label>${input}${miss ? `<div class="why">${it.options[k] ? 'Pick one:' : 'Couldn’t find this'}</div>` : ''}${opts}</div>`;
  };
  const inp = (k, type = 'text') => `<input type="${type}" id="r${i}-${k}" data-r="${i}" data-k="${k}" value="${esc(f[k] ?? '')}" ${type === 'number' ? 'step="any" min="0" inputmode="decimal"' : ''}>`;
  const plat = `<select id="r${i}-platform" data-r="${i}" data-k="platform"><option value="">Pick one</option>${PLAT_IDS.map((p) => `<option value="${p}" ${f.platform === p ? 'selected' : ''}>${esc(R.PLATFORMS[p].name)}</option>`).join('')}</select>`;
  let head = it.kind === 'refund' ? 'Refund or credit back' : 'Lead';
  let extra = '';
  if (it.kind === 'refund') {
    const m = matchLead(f);
    extra = m ? `<div class="notice">Matches your ${R.PLATFORMS[m.platform].short} lead from ${esc(m.customer)} on ${R.longDate(m.date)}. Adding this marks that claim as paid back${f.charge ? ` (${money(f.charge)})` : ''}.</div>`
      : '<div class="notice warn">No matching lead in your ledger yet. Add the lead first, then paste this again.</div>';
  } else if (it.dupe) extra = '<div class="notice warn">This looks like it’s already in your ledger, so it’s unticked.</div>';
  const fields = it.kind === 'refund' ? ['platform', 'date', 'customer', 'charge'] : ['platform', 'date', 'customer', 'job', 'phone', 'charge', 'credits'];
  return `<div class="ritem ${it.include ? '' : 'skip'}">
    <div class="head"><strong>${i + 1}. ${head}${f.status ? ` <span class="small muted" style="font-weight:400">· platform says ${esc(f.status)}</span>` : ''}</strong><label class="check" style="margin:0"><input type="checkbox" data-inc="${i}" ${it.include ? 'checked' : ''}> Add this</label></div>
    ${extra}
    <div class="grid">${fields.map((k) => (k === 'platform' ? cell(k, plat) : cell(k, inp(k, k === 'date' ? 'date' : ['charge', 'credits'].includes(k) ? 'number' : 'text')))).join('')}</div>
    ${it.notes.length ? `<p class="small muted" style="margin:8px 0 0">${it.notes.map(esc).join(' ')}</p>` : ''}
    <details class="raw"><summary>Show the email</summary><pre>${esc(it.raw)}</pre></details></div>`;
}

function csvHtml() {
  const c = ui.csv;
  let out = `<div class="card"><label for="csv-file">Choose a CSV file</label>
    <input type="file" id="csv-file" accept=".csv,text/csv">
    <p class="hint">Any export with a header row works: a platform’s lead or billing export, or your own spreadsheet saved as CSV. We match the columns, and you can change any match.</p>
    <div class="row"><button class="btn" data-act="sample-csv">Use the sample CSV</button></div></div>`;
  if (!c) return out;
  const opt = (sel) => `<option value="">Not in this file</option>` + c.headers.map((h, i) => `<option value="${i}" ${String(sel) === String(i) ? 'selected' : ''}>${esc(h)}</option>`).join('');
  out += `<div class="card"><h2>${esc(c.name)}: ${c.rows.length} rows</h2>
    <div class="field"><label for="csv-platform">Whose leads are these?</label><select id="csv-platform">
      <option value="" ${!c.platform ? 'selected' : ''}>Read it from a column</option>${PLAT_IDS.map((p) => `<option value="${p}" ${c.platform === p ? 'selected' : ''}>${esc(R.PLATFORMS[p].name)}</option>`).join('')}</select></div>
    <div class="map">${P.CSV_FIELDS.map((k) => `<div class="field"><label for="map-${k}">${{ date: 'Date', platform: 'Platform', customer: 'Customer', job: 'Job', phone: 'Phone', charge: 'Charge', credits: 'Credits', status: 'Platform status', outcome: 'Outcome', value: 'Job value' }[k]}</label><select id="map-${k}" data-map="${k}">${opt(c.map[k])}</select></div>`).join('')}</div>`;
  const res = P.rowsToLeads(c.rows, c.map, { platform: c.platform, dateOrder: state.settings.dateOrder });
  const fresh = res.leads.filter((l) => !alreadyIn(l));
  out += `<p><strong>${fresh.length} ready to add.</strong>${res.leads.length - fresh.length ? ` ${res.leads.length - fresh.length} already in your ledger.` : ''} ${res.problems.length ? `<span class="bad-t">${res.problems.length} row${res.problems.length === 1 ? "" : "s"} we couldn’t read</span>, listed below. They won’t be added; fix them in the file or add them by hand.` : ''}</p>`;
  if (fresh.length) out += `<div class="table-wrap" style="margin-bottom:12px"><table class="data"><thead><tr><th>Date</th><th class="left">Platform</th><th class="left">Customer</th><th class="left">Job</th><th>Charge</th><th class="left">Outcome</th></tr></thead><tbody>
      ${fresh.slice(0, 5).map((l) => `<tr><td>${shortDate(l.date)}</td><td class="left">${esc(R.PLATFORMS[l.platform].short)}</td><td class="left">${esc(l.customer)}</td><td class="left">${esc(l.job)}</td><td class="num">${esc(costText(l))}</td><td class="left">${esc(R.OUTCOME_LABEL[l.outcome])}</td></tr>`).join('')}
      </tbody></table></div>${fresh.length > 5 ? `<p class="small muted">And ${fresh.length - 5} more.</p>` : ''}`;
  if (res.problems.length) out += `<details open><summary class="bad-t">Rows we couldn’t read</summary><ul class="problems small">${res.problems.slice(0, 50).map((p) => `<li>Row ${p.row}: ${esc(p.why.join('; '))}</li>`).join('')}</ul>${res.problems.length > 50 ? `<p class="small muted">And ${res.problems.length - 50} more.</p>` : ''}</details>`;
  out += `<div class="row end"><button class="btn primary" data-act="add-csv" ${fresh.length ? '' : 'disabled'}>Add ${fresh.length} to the ledger</button></div></div>`;
  return out;
}

// ---------- claims ----------
function viewClaims() {
  if (!state.leads.length) return `<h1>Claims</h1><p class="card muted">Add some leads and mark what happened to them. Leads you can claim back show up here.</p>`;
  const all = state.leads.map((l) => ({ l, c: claimOf(l) })).filter((x) => x.c);
  const by = (s) => all.filter((x) => x.c.status === s);
  const open = by('claim').sort((a, b) => a.c.daysLeft - b.c.daysLeft), check = by('check').sort((a, b) => a.c.daysLeft - b.c.daysLeft);
  const tracked = by('tracked'), feedback = by('feedback'), auto = by('auto'), late = by('late'), blocked = by('blocked');
  const unconf = by('unconfirmed').filter((x) => R.JUNK.includes(x.l.outcome));
  const worth = (xs) => xs.reduce((s, x) => s + (M.leadCost(x.l, state.settings) || 0), 0);
  const back = tracked.filter((x) => x.l.claim.state === 'won').reduce((s, x) => s + (Number(x.l.claim.amount) || 0), 0);
  const waiting = tracked.filter((x) => x.l.claim.state === 'sent').length;
  const soonest = open.concat(check)[0];
  let html = `<div class="section-head"><div><h1>Claims</h1><p class="muted">Leads that fit a platform’s own written credit or refund rules, inside its time limit. You send each claim yourself.</p></div></div>
  <div class="sumrow">
    <div class="stat"><div class="k">Ready to claim</div><div class="v num">${open.length}</div><div class="small muted">${money(worth(open))} in charges</div></div>
    <div class="stat"><div class="k">Worth a check first</div><div class="v num">${check.length}</div><div class="small muted">${money(worth(check))} in charges</div></div>
    <div class="stat"><div class="k">Next deadline</div><div class="v">${soonest ? shortDate(soonest.c.deadline) : '—'}</div><div class="small muted">${soonest ? days(soonest.c.daysLeft) : 'Nothing due'}</div></div>
    <div class="stat"><div class="k">Got back so far</div><div class="v num">${money(back)}</div><div class="small muted">${waiting} waiting on an answer</div></div>
  </div>`;
  if (!open.length && !check.length && !feedback.length) html += '<p class="card">Nothing to claim right now. When you mark a lead as a bad number, spam, a duplicate, wrong service or out of area, it shows up here if the platform’s rules cover it.</p>';
  if (open.length) html += `<div class="group"><h2>Claim these</h2><p class="muted small">Each fits a reason the platform names in writing. Soonest deadline first.</p></div>` + open.map(claimCard).join('');
  if (check.length) html += `<div class="group"><h2>Check one thing first</h2><p class="muted small">The rule covers these only in some cases. Answer the question on each before you send.</p></div>` + check.map(claimCard).join('');
  if (feedback.length) html += `<div class="group"><h2>Google: rate these leads</h2><p class="muted small">Google has no claim form. It credits poor leads on its own within about 30 days, and takes feedback through “Rate this lead”.</p></div>` + feedback.map(claimCard).join('');
  if (tracked.length) html += `<div class="group"><h2>Sent</h2></div><ul class="mini">${tracked.sort((a, b) => (a.l.claim.on < b.l.claim.on ? 1 : -1)).map(trackedRow).join('')}</ul>`;
  const mini = (title, note, xs) => (xs.length ? `<div class="group"><h2>${title}</h2><p class="muted small">${note}</p></div><ul class="mini">${xs.map(({ l, c }) => `<li><span class="grow">${chip(l.platform)} <strong>${esc(l.customer || 'No name')}</strong> · ${esc(R.OUTCOME_LABEL[l.outcome])} · ${shortDate(l.date)}${c.deadline && c.status === 'late' ? ` · window closed ${shortDate(c.deadline)}` : ''}</span><span class="small muted">${esc(c.reason.means)}</span></li>`).join('')}</ul>` : '');
  html += mini('Thumbtack may refund these by itself', 'Fair Shot Refunds are automatic when its conditions are met. Nothing to send; check Payments in the Thumbtack app.', auto);
  html += mini('No credits on your Angi annual plan', 'Angi doesn’t credit leads on annual subscriptions. You can still report a lead or call Angi Customer Care on (877) 947-3639.', blocked);
  html += mini('Rule not confirmed', 'We couldn’t find this platform’s rule for these in a source we could read, so we don’t flag them.', unconf);
  html += mini('Too late', 'The platform’s claim window has closed.', late);
  return html;
}

function claimCard({ l, c }) {
  const r = c.rule, s = R.SOURCES[c.reason.source];
  const dupes = l.outcome === 'duplicate' ? R.duplicateOf(state.leads) : {};
  const firstDupe = dupes[l.id] ? state.leads.find((x) => x.id === dupes[l.id]) : null;
  const text = l.draft ?? (c.status === 'feedback' ? R.draftFeedback(l) : R.draftClaim(l, state.settings, firstDupe));
  const when = c.status === 'feedback' ? `<span class="tag info">Google reviews it until ${shortDate(c.deadline)}</span>`
    : `<span class="when ${c.daysLeft <= 3 ? 'soon' : ''}">Claim by ${R.longDate(c.deadline)}</span> <span class="small muted">${days(c.daysLeft)}</span>`;
  return `<article class="card claim-card" data-id="${esc(l.id)}"><div class="claim">
    <div>
      <div class="head">${chip(l.platform)} ${when}</div>
      <h3 style="margin:4px 0 2px">${esc(l.customer || 'No name')}${l.job ? ` · ${esc(l.job)}` : ''}</h3>
      <p class="small muted">${R.longDate(l.date)}${costText(l) ? ` · ${esc(costText(l))}` : ''} · you marked it “${esc(R.OUTCOME_LABEL[l.outcome])}”</p>
      <p><strong>${esc(c.reason.reason)}.</strong> ${esc(c.reason.means)}</p>
      ${c.status === 'check' ? `<div class="notice warn"><strong>Check first:</strong> ${esc(c.reason.ask)}</div>` : ''}
      ${r.conditions.length ? `<p class="small" style="margin-bottom:4px"><strong>Before you send, make sure:</strong></p><ul>${r.conditions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="small" style="margin-bottom:4px"><strong>How to ${c.status === 'feedback' ? 'rate it' : 'claim'}:</strong></p><ol>${r.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="small muted">${esc(r.payout)}</p>
      <p class="src">Source: <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>, read ${R.longDate(R.READ)}.</p>
    </div>
    <div>
      <label for="d-${esc(l.id)}">${c.status === 'feedback' ? 'Feedback to paste into the survey' : 'Your claim, ready to paste'}</label>
      <textarea id="d-${esc(l.id)}" data-draft="${esc(l.id)}" rows="11">${esc(text)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn" data-act="copy">Copy text</button>
        <button class="btn primary" data-act="sent">${c.status === 'feedback' ? 'I’ve rated it' : 'I’ve sent it'}</button>
        ${l.draft !== undefined ? '<button class="btn ghost sm" data-act="reset-draft">Reset text</button>' : ''}</div>
    </div></div></article>`;
}
function trackedRow({ l }) {
  const k = l.claim.state;
  const recv = ui.receive === l.id;
  const label = k === 'won' ? `<span class="tag ok">Got ${Number(l.claim.amount) > 0 ? money(Number(l.claim.amount)) : 'it'} back</span>` : k === 'denied' ? '<span class="tag mute">Denied</span>' : `<span class="tag info">${l.platform === 'lsa' ? 'Rated' : 'Sent'} ${shortDate(l.claim.on)}</span>`;
  return `<li data-id="${esc(l.id)}"><span class="grow">${chip(l.platform)} <strong>${esc(l.customer || 'No name')}</strong> · ${esc(R.OUTCOME_LABEL[l.outcome])} · ${esc(costText(l))}</span>${label}
    ${recv ? `<form class="row" data-receive="${esc(l.id)}"><label class="sr-only" for="amt-${esc(l.id)}">Amount back</label><input type="number" step="any" min="0" inputmode="decimal" id="amt-${esc(l.id)}" name="amount" style="width:120px" value="${M.leadCost(l, state.settings) ?? ''}" placeholder="${esc(cur())}"><button class="btn sm primary" type="submit">Save</button></form>`
      : `${k !== 'won' ? '<button class="btn sm" data-act="got-back">Got it back</button>' : ''}${k === 'sent' ? '<button class="btn sm" data-act="denied">Denied</button>' : ''}<button class="btn sm ghost" data-act="undo-claim">Undo</button>`}</li>`;
}

// ---------- maths ----------
function viewMaths() {
  if (!state.leads.length) return `<h1>Lead maths</h1><p class="card muted">Add leads to see what each platform really costs you.</p>`;
  const t = todayISO().slice(0, 7);
  const back = (n) => { let y = +t.slice(0, 4), m = +t.slice(5, 7) - (n - 1); while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
  const range = ui.period === 'all' ? null : [back(Number(ui.period)), t];
  const stats = M.computeStats(state.leads, state.settings, range);
  const ids = Object.keys(stats.platforms);
  const fmt = (n) => (n === null ? '—' : money(Math.round(n * 100) / 100));
  const x = (n) => (n === null ? '—' : `${n.toFixed(1)}×`);
  let html = `<div class="section-head"><div><h1>Lead maths</h1><p class="muted">What each platform costs per lead, per quote and per won job, and whether it pays.</p></div>
    <div><label for="period" class="sr-only">Period</label><select id="period">${[['all', 'All time'], ['3', 'Last 3 months'], ['6', 'Last 6 months'], ['12', 'Last 12 months']].map(([k, v]) => `<option value="${k}" ${ui.period === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>`;
  if (!Number(state.settings.margin)) html += `<div class="notice warn">Add your usual gross margin in <a href="#/settings">Settings</a> to get a profit read, not just revenue.</div>`;
  if (!ids.length) return html + '<p class="card muted">No leads in this period.</p>';
  html += `<div class="card"><h2>All platforms</h2><div class="table-wrap"><table class="data"><thead><tr><th>Platform</th><th>Leads</th><th>Spent</th><th>Per lead</th><th>Per won job</th><th>Jobs won ÷ spend</th><th class="left">Read</th></tr></thead><tbody>
    ${ids.map((id) => { const s = stats.platforms[id].total, rd = M.readFor(s, state.settings); return `<tr><td>${esc(R.PLATFORMS[id].name)}</td><td class="num">${s.leads}</td><td class="num">${fmt(s.net)}</td><td class="num">${fmt(s.cpl)}</td><td class="num">${fmt(s.cpw)}</td><td class="num">${x(s.roas)}</td><td class="left"><span class="verdict ${rd.verdict}">${esc(rd.title)}</span></td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="src" style="margin-top:10px">How the read works: profit from won jobs (job value × your margin) against what the leads cost after credits back. Under 1 to 1 you lose money; 1 to 3 pays but thinly; 3 to 1 or better is healthy. That last line follows Alex Hormozi’s LTGP-to-CAC benchmark in <em>$100M Leads</em> (“Run Paid Ads Part II: Money Stuff”), which he calls “a pattern I personally observed, not a rule”. We count only the first job’s profit, so repeat work makes the real picture better. Leads still “Not sorted yet” count in the cost but not the results.</p></div>`;
  for (const id of ids) {
    const { months, total: s } = stats.platforms[id];
    const rd = M.readFor(s, state.settings);
    const notes = [];
    if (s.unsorted) notes.push(`${s.unsorted} lead${s.unsorted === 1 ? '' : 's'} not sorted yet`);
    if (s.unknownCost) notes.push(`${s.unknownCost} with no cost: ${R.PLATFORMS[id].credits ? `set your ${R.PLATFORMS[id].short} price per credit in <a href="#/settings">Settings</a>` : 'add the charge on the lead'}`);
    if (s.wonNoValue) notes.push(`${s.wonNoValue} won job${s.wonNoValue === 1 ? '' : 's'} with no value entered`);
    if (s.fees) notes.push(`includes a ${money(Number(state.settings.fees[id]))} monthly fee`);
    if (s.credited) notes.push(`${money(s.credited)} credited back`);
    html += `<section class="card" data-platform="${id}"><div class="section-head" style="margin-bottom:6px"><h2>${esc(R.PLATFORMS[id].name)}</h2><span class="verdict ${rd.verdict}">${esc(rd.title)}</span></div>
      <p>${esc(rd.why)}</p>
      <div class="kpis">
        <div class="kpi"><div class="k">Spent</div><div class="v num">${fmt(s.net)}</div></div>
        <div class="kpi"><div class="k">Leads</div><div class="v num">${s.leads}</div></div>
        <div class="kpi"><div class="k">Cost per lead</div><div class="v num">${fmt(s.cpl)}</div></div>
        <div class="kpi"><div class="k">Cost per quote</div><div class="v num">${fmt(s.cpq)}</div></div>
        <div class="kpi"><div class="k">Cost per won job</div><div class="v num">${fmt(s.cpw)}</div></div>
        <div class="kpi"><div class="k">Jobs won ÷ spend</div><div class="v num">${x(s.roas)}</div></div>
        ${s.gpRatio !== null ? `<div class="kpi"><div class="k">Profit per ${esc(cur())}1</div><div class="v num">${fmt(s.gpRatio)}</div></div>` : ''}
      </div>
      ${notes.length ? `<p class="small muted">${notes.join(' · ')}.</p>` : ''}
      <div class="table-wrap"><table class="data"><thead><tr><th>Month</th><th>Leads</th><th>Spent</th><th>Credited</th><th>Per lead</th><th>Per quote</th><th>Per won job</th><th>Won</th><th>Job value</th><th>Return</th></tr></thead><tbody>
      ${months.map((m) => `<tr><td>${monthName(m.month)}</td><td class="num">${m.leads}</td><td class="num">${fmt(m.spend)}</td><td class="num">${m.credited ? fmt(m.credited) : '—'}</td><td class="num">${fmt(m.cpl)}</td><td class="num">${fmt(m.cpq)}</td><td class="num">${fmt(m.cpw)}</td><td class="num">${m.won}</td><td class="num">${fmt(m.value)}</td><td class="num">${x(m.roas)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="num">${s.leads}</td><td class="num">${fmt(s.spend)}</td><td class="num">${s.credited ? fmt(s.credited) : '—'}</td><td class="num">${fmt(s.cpl)}</td><td class="num">${fmt(s.cpq)}</td><td class="num">${fmt(s.cpw)}</td><td class="num">${s.won}</td><td class="num">${fmt(s.value)}</td><td class="num">${x(s.roas)}</td></tr>
      </tbody></table></div></section>`;
  }
  return html;
}
const monthName = (m) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

// ---------- rules ----------
function viewRules() {
  const st = { claim: ['ok-t', 'Flags it and drafts the claim'], check: ['warn-t', 'Flags it with a question first'], feedback: ['mute-t', 'Feedback only'], auto: ['mute-t', 'Automatic; nothing to send'], none: ['mute-t', 'No claim'], unconfirmed: ['bad-t', 'Not flagged: unconfirmed'] };
  let html = `<div class="section-head"><div><h1>The rules we use</h1><p class="muted">Each platform’s own written credit or refund rules, read on ${R.longDate(R.READ)}. Every rule links to its source. Where we couldn’t find a rule in the platform’s own words, we say so and don’t flag on it.</p></div></div>
  <div class="notice">Deadlines: “within 14 days” or “less than 45 days old” is counted with the lead’s own day as day 1, so the date we show is the last full day, and never later than the platform’s.</div>`;
  for (const id of PLAT_IDS.filter((p) => p !== 'other')) {
    const r = R.RULES[id];
    const rows = Object.entries(r.reasons).map(([o, x]) => { const s = R.SOURCES[x.source]; return `<tr><td class="left">${esc(R.OUTCOME_LABEL[o])}</td><td class="left">${esc(x.reason)}</td><td class="left">${esc(x.means)}${x.ask ? ` <em>${esc(x.ask)}</em>` : ''}</td><td class="left"><span class="${st[x.status][0]}">${st[x.status][1]}</span></td><td class="left"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(x.source)}</a></td></tr>`; }).join('');
    html += `<section class="card rules"><h2>${chip(id)} ${esc(R.PLATFORMS[id].name)}</h2>
      <p><strong>${esc(r.route)}</strong>${r.window ? ` ${esc(r.window.words)}` : ''}</p>
      ${r.how.length ? `<ol class="small">${r.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      <p class="small muted">${esc(r.payout)}</p>
      <div class="table-wrap"><table class="data rtable"><thead><tr><th class="left">You marked it</th><th class="left">Platform’s reason</th><th class="left">What it means</th><th class="left">Lead Refund Tracker</th><th class="left">Source</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${r.notCovered.length ? `<p class="small" style="margin:12px 0 4px"><strong>Not covered:</strong></p><ul class="small">${r.notCovered.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${r.extra.map((e) => `<p class="small muted">${esc(e.text)} (${esc(e.source)})</p>`).join('')}
    </section>`;
  }
  html += `<section class="card"><h2>Sources</h2><div class="table-wrap"><table class="data"><thead><tr><th class="left">Id</th><th class="left">Source</th></tr></thead><tbody>
    ${Object.entries(R.SOURCES).map(([k, s]) => `<tr><td class="left">${k}</td><td class="left"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin-top:10px">Platforms change these rules. Check the source before you rely on a deadline.</p></section>`;
  return html;
}

// ---------- settings ----------
function viewSettings() {
  const s = state.settings;
  const credit = (id) => `<div class="field"><label for="cp-${id}">${R.PLATFORMS[id].short}: price per credit (${esc(cur())})</label><input type="number" step="any" min="0" inputmode="decimal" id="cp-${id}" data-set="creditPrice.${id}" value="${esc(s.creditPrice[id] ?? '')}"><div class="hint">What one credit costs you, so credits turn into money.</div></div>`;
  const fee = (id) => `<div class="field"><label for="fee-${id}">${R.PLATFORMS[id].short}: monthly fee (${esc(cur())})</label><input type="number" step="any" min="0" inputmode="decimal" id="fee-${id}" data-set="fees.${id}" value="${esc(s.fees[id] ?? '')}"></div>`;
  return `<h1>Settings</h1>
  <div class="card"><h2>You</h2><div class="grid2">
    <div class="field"><label for="s-business">Business name</label><input type="text" id="s-business" data-set="business" value="${esc(s.business)}"><div class="hint">Signs off your claims.</div></div>
    <div class="field"><label for="s-owner">Your name</label><input type="text" id="s-owner" data-set="ownerName" value="${esc(s.ownerName)}"></div>
    <div class="field"><label for="s-currency">Currency sign</label><select id="s-currency" data-set="currency">${['$', 'A$', '£', '€'].map((c) => `<option ${s.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label for="s-order">Dates like 04/11/2026 mean</label><select id="s-order" data-set="dateOrder">
      <option value="auto" ${s.dateOrder === 'auto' ? 'selected' : ''}>Ask me each time</option><option value="dmy" ${s.dateOrder === 'dmy' ? 'selected' : ''}>Day first (4 November)</option><option value="mdy" ${s.dateOrder === 'mdy' ? 'selected' : ''}>Month first (April 11)</option></select></div>
    <div class="field"><label for="s-margin">Usual gross margin (%)</label><input type="number" min="0" max="100" step="any" inputmode="decimal" id="s-margin" data-set="margin" value="${esc(s.margin)}"><div class="hint">What’s left of a job’s price after materials and labour. Used for the keep-or-cut read.</div></div>
  </div></div>
  <div class="card"><h2>Platforms</h2>
    <label class="check field"><input type="checkbox" id="s-annual" data-set="angiAnnual" ${s.angiAnnual ? 'checked' : ''}> I’m on an Angi annual subscription <span class="muted small">(Angi gives no lead credits on annual plans)</span></label>
    <div class="grid2">${credit('bark')}${credit('hipages')}</div>
    <p class="small muted" style="margin:0 0 10px">Monthly fees count toward spend in every month from a platform’s first lead onward. Use them for subscriptions or ad budgets, like Yelp Ads or a hipages plan.</p>
    <div class="grid2">${PLAT_IDS.filter((p) => p !== 'other').map(fee).join('')}</div></div>
  <div class="card"><h2>Your data</h2><p class="muted">It lives only in this browser. Export it to keep a copy or move to another device.</p>
    <div class="row"><button class="btn" data-act="export">Export as a file</button><button class="btn" data-act="import">Import a file</button><button class="btn" data-act="sample">Load sample leads</button><button class="btn danger" data-act="clear">Delete everything</button></div></div>`;
}

// ---------- events ----------
const view = $('#view');
function setLead(id, patch) { const l = state.leads.find((x) => x.id === id); Object.assign(l, patch); save(); return l; }
function rerenderRow(id, focusSel) {
  const li = view.querySelector(`.lead[data-id="${CSS.escape(id)}"]`); const l = state.leads.find((x) => x.id === id);
  if (!li || !l) return render();
  li.outerHTML = leadRow(l, R.duplicateOf(state.leads));
  const b = $('#claim-badge'); const n = openClaims().length; b.textContent = n; b.classList.toggle('hidden', !n);
  if (focusSel) { const el = view.querySelector(`.lead[data-id="${CSS.escape(id)}"] ${focusSel}`); if (el) el.focus(); }
}
function loadSample() {
  const d = sampleData(todayISO());
  state = { leads: d.leads, settings: { ...DEFAULTS, ...d.settings } }; save();
  toast(`Loaded ${d.leads.length} sample leads. Delete them any time in Settings.`);
  location.hash = '#/ledger'; render();
}
function addLeads(list) {
  for (const l of list) state.leads.push({ id: uid(), platform: l.platform, date: l.date, customer: l.customer || '', job: l.job || '', phone: l.phone || '',
    charge: l.charge ?? null, credits: l.credits ?? null, status: l.status || '', outcome: l.outcome || 'new', value: l.value ?? null, note: l.note || '', claim: null, added: todayISO() });
  save();
}
function readPaste(text) {
  const items = P.parseEmails(text, { dateOrder: state.settings.dateOrder });
  ui.pending = { items: items.map((it) => ({ ...it, include: it.kind === 'refund' ? !!matchLead(it.fields) : !alreadyIn(it.fields), dupe: it.kind === 'lead' && alreadyIn(it.fields) })) };
  render();
  const r = $('.review'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function fetchText(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url); return r.text(); }
const SAMPLE_EMAILS = ['angi-lead', 'thumbtack-lead', 'thumbtack-refund', 'lsa-message-lead', 'lsa-missed-call', 'bark-lead', 'hipages-lead', 'yelp-quote-request', 'problem-two-amounts', 'problem-ambiguous-date'];
function loadCsv(text, name) {
  const rows = P.parseCSV(text);
  if (rows.length < 2) { toast('That file has no rows under the header.'); return; }
  const headers = rows[0];
  ui.csv = { name, headers, rows: rows.slice(1), map: P.guessColumns(headers), platform: '' };
  render();
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

view.addEventListener('click', async (e) => {
  const modeBtn = e.target.closest('[data-mode]');
  if (modeBtn) { ui.addMode = modeBtn.dataset.mode; if (modeBtn.tagName === 'BUTTON') render(); return; }
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const it = ui.pending.items[+pick.dataset.pick], k = pick.dataset.k, v = pick.dataset.v;
    it.fields[k] = k === 'charge' || k === 'credits' ? Number(v) : v; delete it.options[k]; it.missing = it.missing.filter((x) => x !== k);
    if (it.kind === 'refund') it.include = !!matchLead(it.fields);
    render(); return;
  }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, row = a.closest('[data-id]'), id = row && row.dataset.id;
  if (act === 'sample') { if (state.leads.length && !confirm('Replace your ledger with the sample leads? Export first if you want to keep it.')) return; loadSample(); }
  else if (act === 'more') { ui.shown += 60; render(); }
  else if (act === 'edit') { ui.editing = ui.editing === id ? null : id; rerenderRow(id, ui.editing ? '[name=customer]' : '[data-act=edit]'); }
  else if (act === 'delete') { if (!confirm('Delete this lead?')) return; state.leads = state.leads.filter((l) => l.id !== id); ui.editing = null; save(); render(); toast('Lead deleted.'); }
  else if (act === 'mark-dupe') { setLead(id, { outcome: 'duplicate' }); rerenderRow(id, '[data-f=outcome]'); toast('Marked as a duplicate.'); }
  else if (act === 'read-emails') { const t = $('#paste').value; if (!t.trim()) { toast('Paste at least one email first.'); return; } readPaste(t); }
  else if (act === 'sample-emails') {
    try { const t = (await Promise.all(SAMPLE_EMAILS.map((n) => fetchText(`fixtures/emails/${n}.eml`)))).join('\n\n'); ui.paste = t; readPaste(t); }
    catch (err) { toast('Couldn’t load the sample emails. Open the app through server.mjs.'); }
  }
  else if (act === 'clear-pending') { ui.pending = null; ui.paste = ''; render(); }
  else if (act === 'add-pending') {
    const take = ui.pending.items.filter((x) => x.include);
    const leads = take.filter((x) => x.kind === 'lead'), refunds = take.filter((x) => x.kind === 'refund');
    const bad = leads.filter((x) => !x.fields.platform || !x.fields.date);
    if (bad.length) { toast(`Add a platform and date to item ${ui.pending.items.indexOf(bad[0]) + 1} first, or untick it.`); return; }
    addLeads(leads.map((x) => x.fields));
    let paid = 0;
    for (const r of refunds) { const m = matchLead(r.fields); if (m) { m.claim = { state: 'won', on: r.fields.date || todayISO(), amount: r.fields.charge ?? M.leadCost(m, state.settings) }; paid++; } }
    save(); ui.pending = null; ui.paste = ''; location.hash = '#/ledger'; render();
    toast(`Added ${leads.length} lead${leads.length === 1 ? '' : 's'}${paid ? ` and ${paid} refund${paid === 1 ? '' : 's'}` : ''}.`);
  }
  else if (act === 'sample-csv') { try { loadCsv(await fetchText('fixtures/sample-leads.csv'), 'sample-leads.csv'); } catch (err) { toast('Couldn’t load the sample CSV. Open the app through server.mjs.'); } }
  else if (act === 'add-csv') {
    const c = ui.csv; const res = P.rowsToLeads(c.rows, c.map, { platform: c.platform, dateOrder: state.settings.dateOrder });
    const fresh = res.leads.filter((l) => !alreadyIn(l)); addLeads(fresh); ui.csv = null; location.hash = '#/ledger'; render();
    toast(`Added ${fresh.length} leads.`);
  }
  else if (act === 'copy') {
    const ta = a.closest('.claim-card').querySelector('textarea');
    try { await navigator.clipboard.writeText(ta.value); toast('Copied. Paste it into the platform’s form.'); } catch (err) { ta.select(); toast('Select-all is done; press Ctrl+C or Cmd+C to copy.'); }
  }
  else if (act === 'sent') { setLead(id, { claim: { state: 'sent', on: todayISO() } }); render(); toast('Moved to Sent. Mark it when you hear back.'); }
  else if (act === 'reset-draft') { const l = state.leads.find((x) => x.id === id); delete l.draft; save(); render(); }
  else if (act === 'got-back') { ui.receive = id; render(); const i = $(`#amt-${CSS.escape(id)}`); if (i) i.focus(); }
  else if (act === 'denied') { const l = state.leads.find((x) => x.id === id); l.claim = { ...l.claim, state: 'denied' }; save(); render(); }
  else if (act === 'undo-claim') { setLead(id, { claim: null }); render(); }
  else if (act === 'export') { download(`lead-ledger-${todayISO()}.json`, JSON.stringify({ app: 'lead-ledger', version: 1, exported: new Date().toISOString(), ...state }, null, 2), 'application/json'); toast('Exported.'); }
  else if (act === 'import') $('#file-json').click();
  else if (act === 'clear') { if (!confirm('Delete every lead and setting in this browser? This can’t be undone unless you exported a file.')) return; state = { leads: [], settings: { ...DEFAULTS } }; save(); ui.pending = null; ui.csv = null; location.hash = '#/ledger'; render(); toast('Everything deleted.'); }
});

view.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.f) {
    const id = t.closest('[data-id]').dataset.id;
    if (t.dataset.f === 'outcome') { const l = setLead(id, { outcome: t.value }); rerenderRow(id, l.outcome === 'won' ? '[data-f=value]' : '[data-f=outcome]'); }
    else { const v = t.value === '' ? null : Number(t.value); setLead(id, { value: v }); }
    return;
  }
  if (t.dataset.r !== undefined) {
    const it = ui.pending.items[+t.dataset.r], k = t.dataset.k;
    it.fields[k] = ['charge', 'credits'].includes(k) ? (t.value === '' ? null : Number(t.value)) : t.value;
    if (it.fields[k] !== '' && it.fields[k] !== null) delete it.options[k];
    if (k === 'platform' || k === 'customer') { if (it.kind === 'refund') it.include = !!matchLead(it.fields); render(); }
    else t.closest('div').classList.toggle('miss', (it.missing.includes(k) || !!it.options[k]) && t.value === '');
    return;
  }
  if (t.dataset.inc !== undefined) { ui.pending.items[+t.dataset.inc].include = t.checked; render(); return; }
  if (t.id === 'f-platform') { ui.filter.platform = t.value; ui.shown = 60; render(); return; }
  if (t.id === 'f-outcome') { ui.filter.outcome = t.value; ui.shown = 60; render(); return; }
  if (t.id === 'period') { ui.period = t.value; render(); return; }
  if (t.id === 'csv-file' && t.files[0]) { loadCsv(await t.files[0].text(), t.files[0].name); return; }
  if (t.id === 'csv-platform') { ui.csv.platform = t.value; render(); return; }
  if (t.dataset.map) { ui.csv.map[t.dataset.map] = t.value === '' ? undefined : Number(t.value); render(); return; }
  if (t.dataset.set) {
    const [a, b] = t.dataset.set.split('.');
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    if (b) state.settings[a] = { ...state.settings[a], [b]: v }; else state.settings[a] = v;
    save(); toast('Saved.');
    if (a === 'currency') render();
  }
});
view.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'f-q') { ui.filter.q = t.value; clearTimeout(ui.qt); ui.qt = setTimeout(() => { render(); const q = $('#f-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); }
  if (t.id === 'paste') ui.paste = t.value;
  if (t.dataset.draft) { const l = state.leads.find((x) => x.id === t.dataset.draft); l.draft = t.value; save(); }
});
view.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.dataset.edit) {
    const d = readLeadForm(f); if (!d.date) { toast('A lead needs a date.'); return; }
    setLead(f.dataset.edit, d); const id = f.dataset.edit; ui.editing = null; rerenderRow(id, '[data-act=edit]'); toast('Saved.');
  } else if (f.id === 'manual-form') {
    const d = readLeadForm(f); if (!d.date) { toast('A lead needs a date.'); return; }
    addLeads([d]); toast(`Added the ${R.PLATFORMS[d.platform].short} lead${d.customer ? ` from ${d.customer}` : ''}.`); location.hash = '#/ledger'; render();
  } else if (f.dataset.receive) {
    const id = f.dataset.receive, l = state.leads.find((x) => x.id === id);
    const amt = f.amount.value === '' ? null : Number(f.amount.value);
    l.claim = { ...l.claim, state: 'won', amount: amt }; ui.receive = null; save(); render(); toast('Nice. Marked as paid back.');
  }
});
document.addEventListener('click', (e) => { const m = e.target.closest('a[data-mode]'); if (m) ui.addMode = m.dataset.mode; }, true);

$('#file-json').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    const next = d.app === 'lead-ledger' ? openState(d) : null;
    if (!next) throw new Error('not ours');
    if (state.leads.length && !confirm(`Replace your ${state.leads.length} leads with the ${next.leads.length} in this file?`)) return;
    state = next; save(); location.hash = '#/ledger'; render(); toast(`Imported ${next.leads.length} leads.`);
  } catch (err) { toast('That isn’t a Lead Refund Tracker export file.'); }
});
$('#theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('ll-theme', document.documentElement.dataset.theme); } catch (e) {}
});

render();
