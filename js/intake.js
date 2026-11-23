// The one-input intake: what the review asks for after the owner pastes or drops lead emails, screenshots or a CSV
// (specs/one-input-tools.md §3.3, AC-L1 to AC-L3; tools-offer.md AC-O12). Pure functions, tested in js/tests.js.
import * as P from './parse.js';

// Asked only when missing: the platform and the date (a claim needs both). Customer and job are optional, and a lead
// with no charge is kept as "unknown cost". A choice between two values the email gives is always asked.
const ASKED = ['platform', 'date'];
export function asksOf(it) {
  return [...new Set([...(it.missing || []).filter((k) => ASKED.includes(k)), ...Object.keys(it.options || {})])];
}

// The owner's own note in a pasted or forwarded email ("Note: spam"), read for an outcome. No note, no outcome:
// the review then asks "What happened?" with one tap (AC-L2).
export function noteOf(raw) {
  const m = String(raw || '').match(/^[ \t>*-]*(?:my\s+)?notes?[ \t]*[:\-–][ \t]*(\S[^\n]*)$/im);
  return m ? m[1].trim() : '';
}
export const outcomeOf = (it) => (it.kind === 'lead' ? P.outcomeFromText(noteOf(it.raw)) : '');

// Leads charged in credits from a platform with no saved price per credit: one question per platform (AC-L3).
export function creditQuestions(items, settings = {}) {
  const out = [];
  for (const it of items) {
    const f = it.fields;
    if (it.kind !== 'lead' || it.include === false || !f.platform || !f.credits) continue;
    if (f.charge !== null && f.charge !== undefined && f.charge !== '') continue;
    if (Number((settings.creditPrice || {})[f.platform]) > 0 || out.includes(f.platform)) continue;
    out.push(f.platform);
  }
  return out;
}

// "Got back so far": only claims marked won with an amount count (AC-O12). A sent claim, or a won one with no amount,
// adds nothing.
export const gotBack = (leads) => leads.reduce((s, l) => s + (l.claim && l.claim.state === 'won' && Number(l.claim.amount) > 0 ? Number(l.claim.amount) : 0), 0);

// The rules' read date is at most 60 days old (tools-offer AC-O7); the pre-publish check fails the build otherwise.
export function rulesFresh(readISO, todayISO, maxDays = 60) {
  const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  return day(todayISO) - day(readISO) <= maxDays;
}
