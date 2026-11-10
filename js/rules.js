// Each platform's own written credit or refund rules, with the source each one comes from (see RULES.md).
// Status of a reason:
//   claim        written reason; the app flags the lead and drafts the claim
//   check        written reason, but it hangs on a fact the app can't see; drafted with that question shown first
//   feedback     no claim route; the platform only takes feedback (Google LSA)
//   none         the platform has no claim route for this
//   unconfirmed  we couldn't find it in a primary source, so we never flag on it
export const READ = '2026-11-02';

export const SOURCES = {
  A1: { platform: 'angi', title: 'Angi Help Center: How to Request a Lead Credit (written August 14, 2026)', url: 'https://intercom.help/angi/en/articles/11403440-how-to-request-a-lead-credit', file: 'sources/angi-11403440-lead-credit.txt' },
  T1: { platform: 'thumbtack', title: 'Thumbtack Help: Refund policy for pros', url: 'https://help.thumbtack.com/article/refund-policy', file: 'sources/thumbtack-refund-policy.txt' },
  T2: { platform: 'thumbtack', title: 'Thumbtack Help: Fair Shot Refund policy', url: 'https://help.thumbtack.com/article/refund-policy-thumbtack-numbers', file: 'sources/thumbtack-fair-shot-refund.txt' },
  G1: { platform: 'lsa', title: 'Local Services Help: How leads work', url: 'https://support.google.com/localservices/answer/7195435', file: 'sources/google-lsa-7195435-how-leads-work.txt' },
  G2: { platform: 'lsa', title: 'Local Services Help: About Automated Local Services Ads lead credits ("How to dispute charges" links here)', url: 'https://support.google.com/localservices/answer/15100654', file: 'sources/google-lsa-auto-credits-15100654.txt' },
  B1: { platform: 'bark', title: 'Bark Help Centre: Credit Return Policy, Eligible reasons for returns, Requesting a Credit Return, Why your return request may not be successful, How Credit Expiration Works (updated Oct 2026)', url: 'https://help.bark.com/hc/en-gb/articles/19262438332060-Eligible-reasons-for-returns', file: 'sources/bark-help-articles.md' },
  H1: { platform: 'hipages', title: 'hipages Tradie Terms, 27 Nov 2025 (PDF), "Lead review"', url: 'https://assets.hipages.com.au/hipagesTradieTerms20251127.pdf', file: 'sources/hipages/terms-20251127.txt' },
  H2: { platform: 'hipages', title: 'hipages: Job leads and credits policy (Wayback copy of 20 Oct 2026; hipages.com.au blocks our region)', url: 'https://hipages.com.au/business/lead-credits-policy', file: 'sources/hipages/lead-credits-policy-wayback-20261020.txt' },
  Y1: { platform: 'yelp', title: 'Yelp Business Help: How does Yelp’s Cost Per Click (CPC) advertising program work?', url: 'https://biz.yelp.com/support-center/article/How-does-Yelp-s-Cost-Per-Click-CPC-advertising-program-work', file: 'sources/yelp-cpc.txt' },
  Y2: { platform: 'yelp', title: 'Yelp Business Help: How do I know my competitors are not … clicking on my Yelp ads?', url: 'https://biz.yelp.com/support-center/article/How-do-I-know-my-competitors-are-not-driving-up-my-traffic-and-clicking-on-my-Yelp-ads', file: 'sources/yelp-click-fraud.txt' },
  Y3: { platform: 'yelp', title: 'Yelp Master Advertising Terms, 11 May 2026, section on third-party and Yelp activity', url: 'https://biz.yelp.com/tos/master_advertising_terms_en_us_20260511', file: 'sources/yelp-master-advertising-terms-20260511.txt' },
};

export const OUTCOMES = [
  ['new', 'Not sorted yet'], ['noanswer', 'No answer'], ['badcontact', 'Bad number or email'], ['wrongservice', 'Wrong service'],
  ['outofarea', 'Out of area'], ['spam', 'Spam or fake'], ['duplicate', 'Duplicate'], ['quoted', 'Quoted'], ['lost', 'Quoted, lost'], ['won', 'Won'],
];
export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES);
export const JUNK = ['badcontact', 'wrongservice', 'outofarea', 'spam', 'duplicate'];

export const PLATFORMS = {
  angi: { name: 'Angi', short: 'Angi', claimWord: 'lead credit' },
  thumbtack: { name: 'Thumbtack', short: 'Thumbtack', claimWord: 'refund' },
  lsa: { name: 'Google Local Services Ads', short: 'Google LSA', claimWord: 'lead feedback' },
  bark: { name: 'Bark', short: 'Bark', claimWord: 'credit return', credits: true },
  hipages: { name: 'hipages', short: 'hipages', claimWord: 'lead review', credits: true },
  yelp: { name: 'Yelp Ads', short: 'Yelp', claimWord: 'report' },
  other: { name: 'Other', short: 'Other', claimWord: 'claim' },
};

export const RULES = {
  angi: {
    route: 'Request a lead credit on the lead itself.',
    window: { days: 45, from: 'lead', words: 'The lead must be less than 45 days old.', source: 'A1' },
    how: ['Angi for Pros app: Leads tab, open the lead, tap the menu in the top right, then Request Credit.',
      'On the web: Leads tab, pick the lead, then Request lead credit near the top.',
      'Angi reviews it within 5 business days.'],
    payout: 'Account credit, used on your next lead charges. It expires if unused within six months.',
    conditions: ['You tried to call the homeowner within 24 hours of getting the lead.', 'Your account has no overdue balance.', 'You are not on an annual subscription.'],
    reasons: {
      badcontact: { status: 'claim', reason: 'Invalid contact info', means: 'The phone number is disconnected, not in service, or isn’t the homeowner’s.', source: 'A1' },
      outofarea: { status: 'claim', reason: 'Wrong location', means: 'The job is outside the ZIP codes set in your profile.', source: 'A1' },
      wrongservice: { status: 'claim', reason: 'Service mismatch', means: 'The job type doesn’t match the services or tasks in your profile.', source: 'A1' },
      duplicate: { status: 'claim', reason: 'Duplicate lead', means: 'You were charged twice for the same lead or homeowner within 45 days.', source: 'A1' },
      spam: { status: 'unconfirmed', reason: 'Spam or fake', means: 'Angi’s list doesn’t name spam on its own. Fake contact details fit “Invalid contact info”: mark the lead that way if the number is bad.', source: 'A1' },
      noanswer: { status: 'none', reason: 'No answer', means: 'Angi says a homeowner not answering is priced in and not eligible.', source: 'A1' },
    },
    notCovered: ['The homeowner doesn’t answer or reply.', 'They hired another pro first.', 'They decided not to go ahead.', 'They are collecting quotes.', 'You quoted and didn’t win.'],
    extra: [{ text: 'Charged while your lead flow was paused is also a reason. The app doesn’t track your pause dates, so check those yourself.', source: 'A1' },
      { text: 'Annual subscriptions get no credits. You can still report the lead, or call Angi Customer Care on (877) 947-3639.', source: 'A1' }],
  },
  thumbtack: {
    route: 'Request a refund within 45 days of the charge.',
    window: { days: 45, from: 'charge', words: 'Request within 45 days of the charge.', source: 'T1' },
    how: ['Request a refund on the lead (Thumbtack’s “How to request a refund” article shows where).', 'Add as much detail as you can and up to six screenshots.',
      'Answers usually come in 24 to 48 hours, up to four days.'],
    payout: 'Refunds go to your Thumbtack balance. To get it on your card instead, contact Thumbtack within 10 business days of approval (not for credit packages or promo balances).',
    conditions: [],
    reasons: {
      badcontact: { status: 'claim', reason: 'Invalid phone number', means: 'The customer’s number is disconnected or invalid. Say why you think so.', source: 'T1' },
      duplicate: { status: 'claim', reason: 'Duplicate lead or charged twice', means: 'Same customer, identical job, within 45 days. A different job from the same person isn’t a duplicate.', source: 'T1' },
      spam: { status: 'claim', reason: 'Lead breaks the Terms of Use', means: 'Report the customer to request the refund.', source: 'T1' },
      outofarea: { status: 'check', reason: 'The job changed a lot', means: 'Only if the customer changed the job after the lead, for example moved it outside your travel area.', ask: 'Did the customer change the location after the lead came in? If the lead showed it from the start, Thumbtack points to your job preferences and usually says no.', source: 'T1' },
      wrongservice: { status: 'check', reason: 'The job changed a lot', means: 'Only if the job became drastically different from the original lead.', ask: 'Did the customer change the job after the lead came in? If the lead showed it from the start, Thumbtack points to your job preferences and usually says no.', source: 'T1' },
      noanswer: { status: 'auto', reason: 'Fair Shot Refund (automatic)', means: 'Thumbtack refunds automatically if the customer replied to no pro within 72 hours, you replied through Thumbtack within four business hours, and you didn’t share your own number or email first. Nothing to send: check Payments.', source: 'T2' },
    },
    notCovered: ['Sent after 45 days from the charge.', 'Free leads.', 'Not enough evidence.', 'Your preferences weren’t set for the jobs you want.', 'The customer hired a different pro.'],
    extra: [{ text: 'A non-flexible date you had blocked in your calendar, and a first reply of “no thanks” on Opportunities leads, also qualify. The app doesn’t track those, so check them yourself.', source: 'T1' }],
  },
  lsa: {
    route: 'No manual claim. Google credits poor leads automatically, and takes your feedback through “Rate this lead”.',
    window: { days: 30, from: 'lead', words: 'Google assesses charged leads over a 30-day period and credits poor ones automatically.', source: 'G1' },
    how: ['Sign in to Local Services Ads, open the menu, then Leads.', 'Open the lead, select “Rate this lead” at the top right, and submit the survey.',
      'Watch the lead’s Charge Status: Charged, Not charged, In review or Credited.'],
    payout: 'Credits go to your account balance, in most cases within 30 days. The original charge still shows on the invoice.',
    conditions: [],
    reasons: {
      badcontact: { status: 'feedback', reason: 'Poor quality or invalid lead', means: 'Google filters invalid leads and credits low-quality ones on its own. You can only rate the lead.', source: 'G1' },
      spam: { status: 'feedback', reason: 'Spam', means: 'Google says spam is filtered out and not charged. If you were charged, rate the lead.', source: 'G1' },
      duplicate: { status: 'feedback', reason: 'Duplicate', means: 'Follow-ups from the same number or email within 15 days of a charged lead shouldn’t be charged again.', source: 'G1' },
      wrongservice: { status: 'none', reason: 'Job type not serviced', means: 'Google no longer credits “job type not serviced” leads. Tighten your job types instead.', source: 'G2' },
      outofarea: { status: 'none', reason: 'Area not serviced', means: 'Google no longer credits “geo not serviced” leads. Tighten your service area instead.', source: 'G2' },
      noanswer: { status: 'none', reason: 'No answer', means: 'A missed call during your business hours that rings over 20 seconds is a valid, charged lead.', source: 'G1' },
    },
    notCovered: ['Job type or area you don’t serve.', 'Health care, tax specialists, and all advertisers in Europe, the Middle East and Africa get no lead credits.'],
    extra: [{ text: 'You aren’t charged for a missed call shorter than 20 seconds, outside your business hours, or that hangs up on your phone menu before pressing a key. If you see one charged, rate the lead.', source: 'G1' }],
  },
  bark: {
    route: 'Request a credit return online within 14 days of buying the lead.',
    window: { days: 14, from: 'lead', words: 'Within 14 days of the lead purchase.', source: 'B1' },
    how: ['Elite Pro: My Responses, then Request Return.', 'Everyone else: Bark’s online Credit Return Request Form (not email, phone or chat).',
      'Use your Bark account email. Attach clear, unedited JPG, PNG or PDF screenshots with timestamps.', 'Bark aims to answer within 48 hours.'],
    payout: 'Credits back to your balance, at Bark’s discretion. Credits bought on or after 1 Nov 2025 expire 3 months after purchase.',
    conditions: [],
    reasons: {
      badcontact: { status: 'claim', reason: 'Invalid phone number or email address', means: 'The number is unreachable, disconnected or someone else’s, or the email bounces.', source: 'B1' },
      spam: { status: 'claim', reason: 'Platform misuse or wrong service', means: 'Phishing, bots, competitor testing, or a request made without the customer’s consent.', source: 'B1' },
      duplicate: { status: 'claim', reason: 'Duplicate charge', means: 'You were charged for the same lead more than once.', source: 'B1' },
      outofarea: { status: 'check', reason: 'Incorrect information', means: 'The request had misleading details, such as the wrong location.', ask: 'Was the location on the request wrong? If it was right and outside your area, Bark says to filter it with your lead preferences and declines it.', source: 'B1' },
      wrongservice: { status: 'check', reason: 'Incorrect information', means: 'The request had misleading details, such as the wrong category or scope.', ask: 'Was the category or scope on the request wrong? If it was right, Bark says to filter it with your lead preferences and declines it.', source: 'B1' },
      noanswer: { status: 'none', reason: 'No response', means: 'Bark says a customer not replying doesn’t make a lead invalid.', source: 'B1' },
    },
    notCovered: ['The customer hired someone else.', 'The customer didn’t reply.', 'They changed the scope after talking to you.', 'You still have enough credits to contact another lead.', 'More than 14 days after buying the lead.'],
    extra: [{ text: 'Get Hired Guarantee: on your first Starter Pack, if you use the credits and aren’t hired, Bark returns the credits you used. Contact support to claim it.', source: 'B1' }],
  },
  hipages: {
    route: 'Ask for a lead review within 7 days of accepting the lead.',
    window: { days: 7, from: 'lead', words: '7 days from accepting a job lead to request a review.', source: 'H1' },
    how: ['Request a review through hipages’ Lead Review Process (in the app, or contact hipages by email or in-app).', 'Use the date you accepted the lead.'],
    payout: 'If the lead isn’t genuine, hipages gives the credits back. Returned credits expire on the same terms as the originals.',
    conditions: [],
    reasons: {
      spam: { status: 'claim', reason: 'Lead not genuine', means: 'hipages returns the credits if a lead you accepted turns out not to be genuine.', source: 'H1' },
      badcontact: { status: 'unconfirmed', reason: 'Bad contact details', means: 'hipages judges “genuine” by its own criteria, which we couldn’t read. Not flagged.', source: 'H1' },
      duplicate: { status: 'unconfirmed', reason: 'Duplicate', means: 'Not named in the terms we could read. Not flagged.', source: 'H1' },
      wrongservice: { status: 'unconfirmed', reason: 'Wrong service', means: 'Not named in the terms we could read. Not flagged.', source: 'H1' },
      outofarea: { status: 'unconfirmed', reason: 'Out of area', means: 'Not named in the terms we could read. Not flagged.', source: 'H1' },
      noanswer: { status: 'unconfirmed', reason: 'No answer', means: 'Not named in the terms we could read. Not flagged.', source: 'H1' },
    },
    notCovered: [],
    extra: [{ text: 'Credits per lead move with job size, category, location, timing and demand. Credits need using within your subscription or pack period.', source: 'H2' }],
  },
  yelp: {
    route: 'No per-lead claim. Yelp Ads charge per click, not per lead.',
    window: null,
    how: ['If you suspect click fraud, report it to Yelp: (877) 767-9357, or log in to the Business Help Center.'],
    payout: 'Yelp’s ad terms say clicks from other people are your risk. If Yelp itself caused invalid clicks, the only remedy is replacement ads.',
    conditions: [],
    reasons: Object.fromEntries(['badcontact', 'spam', 'duplicate', 'wrongservice', 'outofarea', 'noanswer'].map((k) => [k,
      { status: 'none', reason: 'No per-lead claim', means: 'Yelp bills ad clicks, not leads, and filters rapid repeat clicks itself.', source: 'Y1' }])),
    notCovered: ['Clicks or leads from third parties, fraudulent or not.'],
    extra: [{ text: 'Yelp says it doesn’t bill rapid repeat clicks from the same user and investigates click-fraud reports.', source: 'Y2' },
      { text: 'Fees for ads delivered as ordered are non-refundable; Yelp’s own measurements decide the charges.', source: 'Y3' }],
  },
  other: { route: 'No rules loaded for this platform.', window: null, how: [], payout: '', conditions: [], reasons: {}, notCovered: [], extra: [] },
};

// --- dates ---
export const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
export const fromDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
export const addDays = (s, n) => fromDay(toDay(s) + n);
export const daysBetween = (a, b) => toDay(b) - toDay(a);
// "within N days" and "less than N days old": the lead's own day counts as day 1, so the last day is date + N - 1.
export const lastDay = (date, days) => addDays(date, days - 1);

// What, if anything, can be claimed back on this lead today.
export function claimFor(lead, settings = {}, today) {
  const r = RULES[lead.platform];
  if (!r || !lead.date) return null;
  if (lead.claim && lead.claim.state) return { status: 'tracked', state: lead.claim.state, rule: r };
  const reason = r.reasons[lead.outcome];
  if (!reason) return null;
  const out = { status: reason.status, reason, rule: r, platform: lead.platform };
  if (lead.platform === 'angi' && settings.angiAnnual && (reason.status === 'claim')) return { ...out, status: 'blocked' };
  if (r.window && ['claim', 'check', 'feedback'].includes(reason.status)) {
    out.deadline = lastDay(lead.date, r.window.days);
    out.daysLeft = daysBetween(today, out.deadline);
    if (out.daysLeft < 0 && reason.status !== 'feedback') return { ...out, status: 'late' };
    if (out.daysLeft < 0) return { ...out, status: 'none', reason: { ...reason, means: 'Google’s automatic review window has passed.' } };
  }
  return out;
}

// --- possible duplicates: same platform, same phone (or same name when no phone), within the platform's window ---
const DUP_DAYS = { angi: 45, thumbtack: 45, lsa: 15, bark: 45, hipages: 45, yelp: 45, other: 45 };
export function duplicateOf(leads) {
  const out = {};
  const key = (l) => (l.phone && l.phone.replace(/\D/g, '').length >= 8 ? 'p' + l.phone.replace(/\D/g, '').slice(-9) : 'n' + String(l.customer || '').toLowerCase().replace(/[^a-z]/g, ''));
  const sorted = leads.filter((l) => l.date && (l.customer || l.phone)).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  sorted.forEach((l, i) => {
    for (let j = i - 1; j >= 0; j--) {
      const e = sorted[j];
      if (daysBetween(e.date, l.date) > DUP_DAYS[l.platform]) break;
      if (e.platform === l.platform && key(e) === key(l) && key(l).length > 2) { out[l.id] = e.id; break; }
    }
  });
  return out;
}

// --- claim text the owner sends themselves ---
const PLAIN_REASON = {
  badcontact: (l) => `The contact details don’t work${l.phone ? `: ${l.phone} is disconnected, not in service or isn’t the customer’s` : ''}.`,
  wrongservice: () => 'The job asked for is a service I don’t offer.',
  outofarea: () => 'The job is outside the area I cover.',
  spam: () => 'The lead isn’t genuine. It looks like spam or a fake request.',
  duplicate: (l, dupe) => `I was charged for this customer twice${dupe ? `; the first lead came in on ${longDate(dupe.date)}` : ''}.`,
};
export function longDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function money(n, cur = '$') {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  const neg = n < 0; const v = Math.round(Math.abs(n) * 100) / 100;
  const s = v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return (neg ? '−' : '') + cur + s;
}
export function chargeText(lead, settings = {}) {
  const cur = settings.currency || '$';
  if (lead.charge !== null && lead.charge !== undefined) return money(lead.charge, cur);
  if (lead.credits) return `${lead.credits} credits`;
  return '';
}

export function draftClaim(lead, settings = {}, dupe = null) {
  const r = RULES[lead.platform], reason = r && r.reasons[lead.outcome];
  if (!reason || !PLAIN_REASON[lead.outcome]) return '';
  const p = PLATFORMS[lead.platform];
  const who = lead.customer || 'this customer';
  const what = lead.job ? ` for ${lead.job}` : '';
  const paid = chargeText(lead, settings);
  const lines = [];
  lines.push(`Hi ${p.short} team,`, '');
  lines.push(`I’d like to request a ${p.claimWord} for the lead from ${who}${what}, received on ${longDate(lead.date)}${paid ? ` (charged ${paid})` : ''}.`, '');
  lines.push(`Reason: ${reason.reason}. ${PLAIN_REASON[lead.outcome](lead, dupe)}`);
  if (lead.note) lines.push('', `What happened: ${lead.note.trim()}`);
  if (lead.platform === 'angi') lines.push('', 'I tried to call the homeowner within 24 hours of getting the lead.');
  if (lead.platform === 'bark' || lead.platform === 'thumbtack') lines.push('', 'Screenshots are attached.');
  lines.push('', 'Thanks for looking into it.', settings.ownerName || '', settings.business || '');
  return lines.join('\n').replace(/\n+$/, '');
}

export function draftFeedback(lead) {
  const why = { badcontact: 'the contact details don’t work', spam: 'it isn’t a genuine customer', duplicate: 'it repeats a lead I was already charged for' }[lead.outcome] || 'it wasn’t a real job';
  return `Poor lead: ${why}.${lead.note ? ' ' + lead.note.trim() : ''}`;
}
