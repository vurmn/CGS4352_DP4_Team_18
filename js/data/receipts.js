// Receipts: a record of everything Jordan agreed to, and the small NC.receipts helper the
// screens (and Bianca's and Tri's flows) use to read and change them.
(function () {
  const NC = (window.NC = window.NC || {});

  const STALE_DAYS = 30;
  // Statuses where the company still holds the real thing
  const HOLDS = ['shared', 'pending_delete'];
  // Statuses that mean they never got it, or it's gone now
  const GONE = ['not_shared', 'declined', 'deleted'];
  const TAKE_BACK_STATUS = { mask: 'masked', off: 'off', unsubscribe: 'unsubscribed', revoke: 'not_shared' };
  // The order take back options show up in, so the review reads the same every time
  const ACTION_ORDER = { off: 0, mask: 1, revoke: 2, unsubscribe: 3 };
  // The stale nudge leads with the most personal thing they still hold
  const NUDGE_ORDER = ['phone', 'location', 'contacts', 'health', 'birthday', 'email', 'photos', 'adCookies', 'analyticsCookies', 'marketing', 'notifications'];

  // Every company practice below is a made-up example for the class demo.
  const SEED = [
    {
      id: 'walmart',
      via: 'Sign-up',
      agreedDaysAgo: 39,
      openedDaysAgo: 31,
      takeBackNote: 'Your account and past orders keep working.',
      practices: { keptFor: 'Until you ask them to delete it', sharedWith: '6 advertising partners', usedFor: 'Ads and marketing emails' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Order receipts and sign-in links' },
        {
          type: 'phone', verdict: 'not_needed', note: 'Only uses it for ads',
          takeBack: { action: 'mask', label: 'Mask my phone number', hint: 'Walmart gets your masked number instead' },
        },
        { type: 'birthday', verdict: 'not_needed', note: 'Asked at sign-up for birthday deals', stuck: 'Can\'t be taken back here. Ask Walmart to delete it instead.' },
        {
          type: 'adCookies', verdict: 'not_needed', note: 'Follows you around the web with ads',
          takeBack: { action: 'off', label: 'Turn off ad cookies', hint: 'Stops ads that follow you to other sites' },
        },
        {
          type: 'marketing', verdict: 'optional', note: 'Deals and promo emails',
          takeBack: { action: 'unsubscribe', label: 'Unsubscribe from marketing', hint: 'Order updates still come through' },
        },
      ],
      history: [{ daysAgo: 39, text: 'Signed up on walmart.com' }],
    },
    {
      id: 'quizlet',
      via: 'Sign-up',
      agreedDaysAgo: 48,
      openedDaysAgo: 1,
      takeBackNote: 'Your study sets keep working.',
      practices: { keptFor: 'Until you delete your account', sharedWith: 'No partners listed', usedFor: 'Your study sets and reminders' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Your login and study reminders' },
        { type: 'files', verdict: 'needed', note: 'Flashcard sets and notes you uploaded' },
      ],
      history: [{ daysAgo: 48, text: 'Signed up with your school email' }],
    },
    {
      id: 'adidas',
      via: 'App permissions',
      agreedDaysAgo: 54,
      openedDaysAgo: 2,
      takeBackNote: 'Your runs and account keep working.',
      practices: { keptFor: '5 years after your last run', sharedWith: '2 fitness partners', usedFor: 'Run stats and product offers' },
      items: [
        { type: 'location', verdict: 'needed', note: 'Maps your runs while you track them' },
        {
          type: 'health', verdict: 'optional', note: 'Heart rate and steps for weekly stats',
          takeBack: { action: 'revoke', label: 'Stop sharing health data', hint: 'Runs still save, just without heart rate' },
        },
      ],
      history: [{ daysAgo: 54, text: 'Allowed location and health data' }],
    },
    {
      id: 'snapchat',
      via: 'Sign-up',
      agreedDaysAgo: 61,
      openedDaysAgo: 0,
      takeBackNote: 'Your account, snaps and friends keep working.',
      practices: { keptFor: 'Until you delete your account', sharedWith: 'Advertising partners', usedFor: 'Friend suggestions and ads' },
      items: [
        {
          type: 'phone', verdict: 'not_needed', note: 'Asked to find your friends',
          takeBack: { action: 'mask', label: 'Mask my phone number', hint: 'Snapchat gets your masked number instead' },
        },
        {
          type: 'contacts', verdict: 'not_needed', note: 'Uploaded your contacts to suggest friends',
          takeBack: { action: 'revoke', label: 'Stop syncing contacts', hint: 'Friends you already added stay' },
        },
        { type: 'birthday', verdict: 'needed', note: 'Checks you\'re old enough to use it' },
        {
          type: 'location', verdict: 'optional', note: 'Shows you on Snap Map to friends',
          takeBack: { action: 'off', label: 'Turn off Snap Map', hint: 'Friends stop seeing where you are' },
        },
      ],
      history: [{ daysAgo: 61, text: 'Signed up and synced your contacts' }],
    },
    {
      id: 'doordash',
      via: 'Sign-up',
      agreedDaysAgo: 66,
      openedDaysAgo: 4,
      takeBackNote: 'Your account and saved addresses keep working.',
      practices: { keptFor: 'Until you close your account', sharedWith: 'The restaurant and driver for each order', usedFor: 'Getting your food to you' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Order receipts and sign-in' },
        { type: 'phone', verdict: 'needed', note: 'Texts you delivery updates' },
        { type: 'location', verdict: 'needed', note: 'Finds food near you and delivers it' },
        { type: 'payment', verdict: 'needed', note: 'Pays for your orders' },
        {
          type: 'marketing', verdict: 'optional', note: 'DashPass deals and promo emails',
          takeBack: { action: 'unsubscribe', label: 'Unsubscribe from promos', hint: 'Order texts still come through' },
        },
      ],
      history: [{ daysAgo: 66, text: 'Signed up and saved a card' }],
    },
    {
      // The cookie banner here is one of Task 1's already answered requests, so the two line up
      id: 'shein',
      via: 'Sign-up',
      agreedDaysAgo: 25,
      openedDaysAgo: 20,
      decision: { daysAgo: 25, requestId: 'shein' },
      takeBackNote: 'Your account and past orders keep working.',
      practices: { keptFor: 'Until you ask them to delete it', sharedWith: '12 advertising partners', usedFor: 'Ads, sale emails and your orders' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Order updates and sign-in' },
        { type: 'birthday', verdict: 'not_needed', note: 'Sends a birthday coupon' },
        {
          type: 'marketing', verdict: 'optional', note: 'Daily sale emails',
          takeBack: { action: 'unsubscribe', label: 'Unsubscribe from sale emails', hint: 'Order updates still come through' },
        },
        { type: 'loginCookies', verdict: 'needed', note: 'Keeps you logged in and your cart saved' },
        { type: 'adCookies', verdict: 'not_needed', status: 'not_shared', note: 'Ads that follow you to other sites' },
        { type: 'analyticsCookies', verdict: 'optional', status: 'not_shared', note: 'Counts visits to improve the site' },
      ],
      history: [
        { daysAgo: 25, text: 'Signed up on shein.com' },
        { daysAgo: 25, kind: 'decision', text: 'Allowed only what\'s needed: login cookies. Said no to ad cookies and analytics cookies' },
      ],
    },
    {
      id: 'cnn',
      via: 'Sign-up',
      agreedDaysAgo: 83,
      openedDaysAgo: 3,
      takeBackNote: 'Your newsletter keeps coming.',
      practices: { keptFor: 'Until you unsubscribe', sharedWith: '3 advertising partners', usedFor: 'Newsletters and ads' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Sends the newsletter you signed up for' },
        {
          type: 'marketing', verdict: 'optional', note: 'Extra promos from CNN partners',
          takeBack: { action: 'unsubscribe', label: 'Unsubscribe from promos', hint: 'Your newsletter still comes through' },
        },
      ],
      history: [{ daysAgo: 83, text: 'Signed up for the morning newsletter' }],
    },
    {
      id: 'uber',
      via: 'Sign-up',
      agreedDaysAgo: 18,
      openedDaysAgo: 9,
      decision: { daysAgo: 18, requestId: 'uber' },
      takeBackNote: 'Your account and ride history keep working.',
      practices: { keptFor: 'Until you delete your account', sharedWith: 'Your driver, for each ride', usedFor: 'Rides, receipts and safety checks' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Ride receipts and sign-in' },
        { type: 'location', verdict: 'needed', note: 'So your driver can find you' },
        { type: 'payment', verdict: 'needed', note: 'Pays for your rides' },
        { type: 'contacts', verdict: 'not_needed', status: 'not_shared', note: 'To split fares with friends' },
        { type: 'notifications', verdict: 'optional', status: 'not_shared', note: 'Updates about your ride' },
      ],
      history: [
        { daysAgo: 18, text: 'Signed up and saved a card' },
        { daysAgo: 18, kind: 'decision', text: 'Allowed only what\'s needed: location. Said no to contacts and notifications' },
      ],
    },
    {
      id: 'spotify',
      via: 'Sign-up',
      agreedDaysAgo: 120,
      openedDaysAgo: 0,
      decision: { daysAgo: 12, requestId: 'spotify' },
      takeBackNote: 'Your playlists and Premium keep working.',
      practices: { keptFor: 'Until you close your account', sharedWith: 'Ad partners on the free plan', usedFor: 'Your playlists and music picks' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Sign-in and receipts' },
        { type: 'payment', verdict: 'needed', note: 'Pays for Premium' },
        {
          type: 'notifications', verdict: 'optional', note: 'New music from artists you follow',
          takeBack: { action: 'off', label: 'Turn off notifications', hint: 'No more alerts from Spotify', recommended: false },
        },
        {
          type: 'marketing', verdict: 'optional', note: 'New music and offer emails',
          takeBack: { action: 'unsubscribe', label: 'Unsubscribe from offers', hint: 'Account emails still come through' },
        },
        { type: 'microphone', verdict: 'optional', status: 'not_shared', note: 'For voice search' },
        { type: 'contacts', verdict: 'not_needed', status: 'not_shared', note: 'To find friends who listen' },
      ],
      history: [
        { daysAgo: 120, text: 'Signed up for Spotify Premium' },
        { daysAgo: 12, kind: 'decision', text: 'Shared notifications. Said no to microphone and contacts' },
      ],
    },
    {
      id: 'google-maps',
      via: 'App permissions',
      agreedDaysAgo: 33,
      openedDaysAgo: 1,
      decision: { daysAgo: 33, requestId: 'google-maps' },
      takeBackNote: 'Directions keep working.',
      practices: { keptFor: '18 months, then it deletes itself', sharedWith: 'No one, unless you share a trip', usedFor: 'Directions and saved places' },
      items: [
        { type: 'location', verdict: 'needed', note: 'Gives you directions' },
        { type: 'email', verdict: 'needed', note: 'Saves your places to your account' },
        { type: 'contacts', verdict: 'not_needed', status: 'not_shared', note: 'To share trips with friends' },
        { type: 'photos', verdict: 'optional', status: 'not_shared', note: 'To add photos to your reviews' },
      ],
      history: [
        { daysAgo: 33, kind: 'decision', text: 'Allowed only what\'s needed: location. Said no to contacts and photos' },
      ],
    },
    {
      id: 'accuweather',
      via: 'Cookie banner',
      agreedDaysAgo: 152,
      openedDaysAgo: 2,
      takeBackNote: 'Forecasts keep working.',
      practices: { keptFor: '13 months', sharedWith: '9 advertising partners', usedFor: 'Ads and site stats' },
      items: [
        {
          type: 'adCookies', verdict: 'not_needed', note: 'Shows you ads based on other sites you visit',
          takeBack: { action: 'off', label: 'Turn off ad cookies', hint: 'Stops ads that follow you to other sites' },
        },
        {
          type: 'analyticsCookies', verdict: 'optional', note: 'Counts which forecasts people read',
          takeBack: { action: 'off', label: 'Turn off analytics cookies', hint: 'They stop tracking how you use the site' },
        },
      ],
      history: [{ daysAgo: 152, text: 'Tapped Accept all on the cookie banner' }],
    },
    {
      id: 'canvas',
      via: 'Sign-up',
      agreedDaysAgo: 176,
      openedDaysAgo: 0,
      takeBackNote: 'Your classes keep working.',
      practices: { keptFor: 'Set by your school', sharedWith: 'Your school and teachers', usedFor: 'Classes, assignments and grades' },
      items: [
        { type: 'email', verdict: 'needed', note: 'Your school login' },
        { type: 'files', verdict: 'needed', note: 'Assignments you turned in' },
        { type: 'loginCookies', verdict: 'needed', note: 'Keeps you logged in' },
      ],
      history: [{ daysAgo: 176, text: 'Signed in through your school' }],
    },
    {
      id: 'chase',
      via: 'Sign-up',
      agreedDaysAgo: 230,
      openedDaysAgo: 5,
      takeBackNote: 'Your accounts and cards keep working.',
      practices: { keptFor: 'At least 5 years, banks have to keep records', sharedWith: 'Credit bureaus and fraud checks', usedFor: 'Running your account and stopping fraud' },
      items: [
        { type: 'phone', verdict: 'needed', note: 'Sends 2-step sign-in codes' },
        { type: 'email', verdict: 'needed', note: 'Statements and account alerts' },
        { type: 'birthday', verdict: 'needed', note: 'Banks have to check who you are' },
        {
          type: 'marketing', verdict: 'optional', note: 'Offers for new cards',
          takeBack: { action: 'unsubscribe', label: 'Unsubscribe from offers', hint: 'Account alerts still come through' },
        },
      ],
      history: [{ daysAgo: 230, text: 'Opened a student checking account' }],
    },
  ];

  // Apps that only get a receipt once you answer them (Task 1 or your rules)
  const PRACTICES = {
    'temple-run': { keptFor: 'Until you delete your account', sharedWith: 'No partners listed', usedFor: 'Saving your game progress' },
    'candy-crush': { keptFor: 'Until you delete the game', sharedWith: 'Advertising partners', usedFor: 'Game progress and ads' },
    accuweather: { keptFor: '13 months', sharedWith: '9 advertising partners', usedFor: 'Forecasts and ads' },
    cnn: { keptFor: 'Until you unsubscribe', sharedWith: '3 advertising partners', usedFor: 'Newsletters and ads' },
  };
  const NO_PRACTICES = { keptFor: 'Not listed in their privacy policy', sharedWith: 'Not listed', usedFor: 'Running the app' };

  // Take back options for things you allowed in a decision but they don't strictly need
  const DEFAULT_TAKE_BACK = {
    location: { action: 'off', label: 'Turn off location', hint: '{app} stops seeing where you are' },
    contacts: { action: 'revoke', label: 'Stop sharing contacts', hint: '{app} can\'t see your friends list anymore' },
    notifications: { action: 'off', label: 'Turn off notifications', hint: 'No more alerts from {app}' },
    photos: { action: 'revoke', label: 'Remove photo access', hint: '{app} can\'t see your photos anymore' },
    camera: { action: 'revoke', label: 'Turn off camera access', hint: 'You can turn it back on when you need it' },
    microphone: { action: 'revoke', label: 'Turn off the microphone', hint: 'You can turn it back on when you need it' },
    adCookies: { action: 'off', label: 'Turn off ad cookies', hint: 'Stops ads that follow you to other sites' },
    analyticsCookies: { action: 'off', label: 'Turn off analytics cookies', hint: 'They stop tracking how you use the site' },
    marketing: { action: 'unsubscribe', label: 'Unsubscribe from marketing', hint: 'Account emails still come through' },
    phone: { action: 'mask', label: 'Mask my phone number', hint: '{app} gets your masked number instead' },
  };

  const day = () => NC.dom.today();
  const iso = (d) => d.toISOString();
  const daysAgoIso = (n) => iso(NC.dom.daysAgo(n));
  let historyCount = 0;

  function historyId() {
    historyCount += 1;
    return 'h' + Date.now().toString(36) + historyCount;
  }

  function fillTakeBack(tb, appName) {
    if (!tb) return undefined;
    return {
      action: tb.action,
      label: tb.label,
      hint: String(tb.hint || '').replace('{app}', appName),
      recommended: tb.recommended !== false,
    };
  }

  function fromSeed(s) {
    const app = NC.app ? NC.app(s.id) : { name: s.id };
    const r = {
      id: s.id,
      appId: s.id,
      via: s.via,
      agreedDaysAgo: s.agreedDaysAgo,
      openedDaysAgo: s.openedDaysAgo,
      agreedAt: daysAgoIso(s.agreedDaysAgo),
      openedAt: daysAgoIso(s.openedDaysAgo),
      takeBackNote: s.takeBackNote,
      items: s.items.map((i) => {
        const item = { type: i.type, verdict: i.verdict, status: i.status || 'shared', note: i.note };
        if (i.takeBack) item.takeBack = fillTakeBack(i.takeBack, app.name);
        if (i.stuck) item.stuck = i.stuck;
        return item;
      }),
      practices: Object.assign({}, s.practices),
      deletion: null,
      history: s.history.map((x) => ({ id: historyId(), at: daysAgoIso(x.daysAgo), text: x.text, kind: x.kind || 'joined' })),
    };
    // Receipts that match one of Task 1's older answers point at that request
    if (s.decision) {
      r.lastAgreedAt = daysAgoIso(s.decision.daysAgo);
      r.requestId = s.decision.requestId;
    }
    return r;
  }

  function seed() {
    const s = { items: SEED.map(fromSeed), nudgesDismissed: [], tipDismissed: false };
    catchUp(s);
    return s;
  }

  if (NC.store && NC.store.seed) NC.store.seed('receipts', seed);

  function slice() {
    return NC.store && NC.store.get ? NC.store.get('receipts') : undefined;
  }

  // Day counts are worked out from the saved dates, so "not opened in 31 days" keeps counting
  function fresh(r) {
    const now = day();
    if (r.agreedAt) r.agreedDaysAgo = Math.max(0, NC.dom.daysBetween(r.agreedAt, now));
    if (r.openedAt) r.openedDaysAgo = Math.max(0, NC.dom.daysBetween(r.openedAt, now));
    r.items = r.items || [];
    r.history = r.history || [];
    return r;
  }

  // The list sorts and groups by the last time you said yes to something
  function dateOf(r) {
    return new Date(r.lastAgreedAt || r.agreedAt || daysAgoIso(r.agreedDaysAgo || 0));
  }

  function all() {
    const s = slice();
    const items = s && Array.isArray(s.items) ? s.items : [];
    return items.map(fresh).sort((a, b) => dateOf(b) - dateOf(a));
  }

  function get(id) {
    const s = slice();
    const r = s && Array.isArray(s.items) ? s.items.find((x) => x.id === id) : null;
    return r ? fresh(r) : null;
  }

  function update(id, fn) {
    if (!get(id)) return null;
    NC.store.update('receipts', (s) => {
      const i = s.items.findIndex((x) => x.id === id);
      const next = fn(s.items[i]);
      if (next && typeof next === 'object') s.items[i] = next;
    });
    return get(id);
  }

  function updateSlice(fn) {
    if (!NC.store || !slice()) return undefined;
    return NC.store.update('receipts', fn);
  }

  function holds(item) {
    return HOLDS.indexOf(item.status) >= 0;
  }

  function isGone(item) {
    return GONE.indexOf(item.status) >= 0;
  }

  function activeDeletion(r) {
    return !!(r && r.deletion && (r.deletion.status === 'sent' || r.deletion.status === 'done'));
  }

  // Things you can switch off right here, in the order the take back screen shows them
  function takeBackOptions(r) {
    if (!r) return [];
    return r.items
      .filter((i) => i.takeBack && i.status === 'shared')
      .sort((a, b) => (ACTION_ORDER[a.takeBack.action] || 0) - (ACTION_ORDER[b.takeBack.action] || 0));
  }

  // Shared things they don't need but that only a delete request can get back
  function stuckItems(r) {
    if (!r) return [];
    return r.items.filter((i) => i.status === 'shared' && !i.takeBack && i.verdict !== 'needed');
  }

  function staleItem(r) {
    if (!r) return null;
    const candidates = r.items.filter((i) => i.status === 'shared' && i.verdict !== 'needed' && i.takeBack);
    if (!candidates.length) return null;
    const rank = (t) => {
      const n = NUDGE_ORDER.indexOf(t);
      return n < 0 ? 99 : n;
    };
    return candidates.sort((a, b) => rank(a.type) - rank(b.type))[0];
  }

  // Stale means not opened in a month and still holding something we can take back in one tap
  function isStale(r) {
    const rec = r && r.openedAt ? fresh(Object.assign({}, r)) : r;
    if (!rec || activeDeletion(rec)) return false;
    return (rec.openedDaysAgo || 0) >= STALE_DAYS && !!staleItem(rec);
  }

  function lastTakeBackStatus(r, type) {
    for (let i = r.history.length - 1; i >= 0; i--) {
      const hEntry = r.history[i];
      if (hEntry.kind !== 'take-back' || !Array.isArray(hEntry.changes)) continue;
      const ch = hEntry.changes.find((c) => c.type === type);
      if (ch) return ch.to;
    }
    return null;
  }

  // What an item goes back to if a delete request is cancelled
  function restoreStatus(r, item) {
    return item.prevStatus || lastTakeBackStatus(r, item.type) || 'shared';
  }

  function typeLabel(type) {
    return NC.dataType ? NC.dataType(type).label : type;
  }

  function lower(s) {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }

  // The phone is masked, not taken back, so each change gets its own verb
  const TAKE_BACK_VERB = { off: 'turned off ', revoke: 'turned off ', mask: 'masked your ', unsubscribe: 'unsubscribed from ' };

  // "Turned off ad cookies, masked your phone number and unsubscribed from marketing emails",
  // worded the same way as the list on Tri's done screen
  function takeBackText(changes) {
    const parts = (changes || []).map((ch) => (TAKE_BACK_VERB[ch.action] || 'turned off ') + lower(typeLabel(ch.type)));
    const s = NC.dom.listText(parts);
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function applyTakeBack(id, types) {
    const r = get(id);
    if (!r) return null;
    const picked = takeBackOptions(r).filter((i) => types.indexOf(i.type) >= 0);
    if (!picked.length) return null;
    const changes = picked.map((i) => ({ type: i.type, action: i.takeBack.action, from: i.status, to: TAKE_BACK_STATUS[i.takeBack.action] || 'off' }));
    const entry = {
      id: historyId(),
      at: iso(day()),
      kind: 'take-back',
      text: takeBackText(changes),
      changes,
    };
    update(id, (rec) => {
      changes.forEach((ch) => {
        const item = rec.items.find((i) => i.type === ch.type);
        if (item) item.status = ch.to;
      });
      rec.history.push(entry);
    });
    return { id, historyId: entry.id, changes };
  }

  // Undo only flips back what this change touched and is still the way we left it
  function undoTakeBack(result) {
    if (!result || !get(result.id)) return null;
    return update(result.id, (rec) => {
      result.changes.forEach((ch) => {
        const item = rec.items.find((i) => i.type === ch.type);
        if (item && item.status === ch.to) item.status = ch.from;
      });
      rec.history = rec.history.filter((x) => x.id !== result.historyId);
    });
  }

  function decisionText(request, app, allowed, declined) {
    const mode = request.decision && request.decision.mode;
    const names = (list) => NC.dom.listText(list.map((t) => lower(typeLabel(t))));
    if (mode === 'rules') {
      const what = request.kind === 'cookies' ? app.name + '\'s cookie banner' : app.name;
      return 'Your rules answered ' + what + (declined.length ? ': said no to ' + names(declined) : '');
    }
    const parts = [];
    if (mode === 'needed') parts.push('Allowed only what\'s needed' + (allowed.length ? ': ' + names(allowed) : ''));
    else if (allowed.length) parts.push('Shared ' + names(allowed));
    if (declined.length) parts.push('Said no to ' + names(declined));
    return parts.join('. ') || 'Said no to everything';
  }

  // Remembers the receipt as it was before each decision, so an undo in Task 1 can put it back
  const undoable = {};

  // Writes one decided request onto the receipts list s, dated when it was answered
  function putDecision(s, request, at) {
    const appId = request.appId;
    const app = NC.app ? NC.app(appId) : { name: appId };
    const asks = Array.isArray(request.asks) ? request.asks : [];
    const allowed = (request.decision.allowed || []).slice();
    const declined = (request.decision.declined || []).slice();
    let r = s.items.find((x) => x.id === appId);
    const isNew = !r;
    if (!r) {
      r = {
        id: appId,
        appId,
        via: request.kind === 'cookies' ? 'Cookie banner' : 'App permissions',
        agreedDaysAgo: 0,
        openedDaysAgo: 0,
        agreedAt: at,
        openedAt: at,
        items: [],
        practices: Object.assign({}, PRACTICES[appId] || NO_PRACTICES),
        deletion: null,
        history: [],
      };
      s.items.push(r);
    }
    r.lastAgreedAt = at;
    r.openedAt = at;
    r.requestId = request.id;
    const put = (type, status) => {
      const ask = asks.find((a) => a.type === type) || {};
      let item = r.items.find((i) => i.type === type);
      if (!item) {
        item = { type, verdict: ask.verdict || 'optional' };
        r.items.push(item);
      }
      item.status = status;
      if (ask.verdict) item.verdict = ask.verdict;
      if (ask.reason) item.note = ask.reason;
      const tb = DEFAULT_TAKE_BACK[type];
      if (status === 'shared' && item.verdict !== 'needed' && tb && !item.takeBack) {
        // You picked this one yourself, so we offer it but don't tick it for you
        item.takeBack = Object.assign(fillTakeBack(tb, app.name), { recommended: item.verdict === 'not_needed' });
      }
    };
    const was = {};
    r.items.forEach((i) => {
      was[i.type] = i.status;
    });
    allowed.forEach((t) => put(t, 'shared'));
    declined.forEach((t) => put(t, 'not_shared'));
    // Saving the same choices again shouldn't look like a second change in the history
    const changed = isNew || allowed.concat(declined).some((t) => was[t] !== r.items.find((i) => i.type === t).status);
    r.history.push({ id: historyId(), at, kind: 'decision', text: changed ? decisionText(request, app, allowed, declined) : 'Looked over your choices again, nothing changed' });
  }

  // Would this answer change anything on the receipt we already have?
  function changesItems(r, request) {
    const status = (t) => {
      const i = r.items.find((x) => x.type === t);
      return i ? i.status : null;
    };
    return (request.decision.allowed || []).some((t) => status(t) !== 'shared') ||
      (request.decision.declined || []).some((t) => status(t) !== 'not_shared');
  }

  // Answers given before this file was pushed (Task 1, or the cookie rules) never reached us,
  // so a brand new receipts list catches up on them from Bianca's requests.
  function catchUp(s) {
    if (!NC.store || !NC.store.has || !NC.store.has('requests')) return;
    const reqs = NC.store.get('requests');
    const list = reqs && Array.isArray(reqs.items) ? reqs.items : [];
    list
      .filter((q) => q && q.appId && q.decision && q.decision.at && (q.status === 'decided' || q.status === 'auto'))
      .sort((a, b) => new Date(a.decision.at) - new Date(b.decision.at))
      .forEach((q) => {
        // The older answers in the demo already have receipts, so they only count if they were changed since
        const seeded = s.items.find((r) => r.id === q.appId && r.requestId === q.id);
        if (seeded && !changesItems(seeded, q)) return;
        putDecision(s, q, q.decision.at);
      });
  }

  // Bianca's Task 1 and Tri's rules call this with a decided request
  function recordDecision(request) {
    if (!request || !request.appId || !request.decision || !NC.store || !slice()) return null;
    const appId = request.appId;
    const at = request.decision.at || iso(day());
    const before = get(appId);
    // The catch up above may have just written this exact answer, so don't log it twice
    if (before && before.requestId === request.id && before.lastAgreedAt === at) return before;

    const st = requestStatus(request.id);
    undoable[appId] = { requestId: request.id, before, seenDecided: !!st && st !== 'pending' };
    updateSlice((s) => {
      putDecision(s, request, at);
    });
    return get(appId);
  }

  // Puts a receipt back to how it was before recordDecision (or removes it if it was new)
  function undoDecision(requestOrAppId) {
    const key = typeof requestOrAppId === 'string' ? requestOrAppId : requestOrAppId && requestOrAppId.appId;
    const u = key && undoable[key];
    if (!u) return false;
    delete undoable[key];
    updateSlice((s) => {
      const i = s.items.findIndex((x) => x.id === key);
      if (u.before && i >= 0) s.items[i] = u.before;
      else if (u.before) s.items.push(u.before);
      else if (i >= 0) s.items.splice(i, 1);
    });
    return true;
  }

  function requestStatus(requestId) {
    const reqs = NC.store && NC.store.has && NC.store.has('requests') ? NC.store.get('requests') : null;
    const list = reqs && Array.isArray(reqs.items) ? reqs.items : [];
    const req = list.find((x) => x.id === requestId);
    return req ? req.status : null;
  }

  // If a decided request goes back to pending (the Undo on Task 1's done screen), its receipt change
  // goes too. We wait until we've seen it decided, so the order Task 1 saves things in doesn't matter.
  if (NC.store && NC.store.on) {
    NC.store.on((name) => {
      if (name === '*') {
        Object.keys(undoable).forEach((k) => delete undoable[k]);
        return;
      }
      if (name !== 'requests' || !Object.keys(undoable).length) return;
      Object.keys(undoable).forEach((appId) => {
        const u = undoable[appId];
        const st = requestStatus(u.requestId);
        if (st && st !== 'pending') u.seenDecided = true;
        else if (st === 'pending' && u.seenDecided) undoDecision(appId);
      });
    });
  }

  NC.receipts = {
    all,
    get,
    update,
    recordDecision,
    undoDecision,
    isStale,
    staleItem,
    takeBackOptions,
    stuckItems,
    applyTakeBack,
    undoTakeBack,
    activeDeletion,
    restoreStatus,
    holds,
    isGone,
    dateOf,
    updateSlice,
    slice,
    STALE_DAYS,
  };
})();
