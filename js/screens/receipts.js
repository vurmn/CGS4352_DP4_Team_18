// Receipts tab (Task 3): the list with search and filters, one receipt with its delete tracker,
// and taking back access. The data and NC.receipts live in js/data/receipts.js.
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.router || !NC.c || !NC.dom) return;
  const { h } = NC.dom;
  const c = NC.c;

  // List state lives out here, so coming back from a receipt keeps your search and filter
  const view = { q: '', filter: 'all', searching: false };
  // Take back ticks survive a trip to the delete screen and back
  let draft = null;
  // The "Done, 3 changes applied" toast and the receipt its Undo belongs to
  let undoToast = null;
  // The toast a receipt is making room for at the top, so it never sits on the header
  let roomFor = null;

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'location', label: 'Location', types: ['location'], icon: 'pin', noun: 'your location' },
    { id: 'phone', label: 'Phone #', types: ['phone'], icon: 'phone', noun: 'your real number' },
    { id: 'email', label: 'Email', types: ['email'], icon: 'mail', noun: 'your real email' },
    { id: 'cookies', label: 'Cookies', types: ['adCookies', 'analyticsCookies', 'loginCookies'], icon: 'cookie' },
    { id: 'birthday', label: 'Birthday', types: ['birthday'], icon: 'cake', noun: 'your birthday' },
    { id: 'health', label: 'Health', types: ['health'], icon: 'heart', noun: 'your health data' },
  ];

  // How each kind of data reads in "Shared: email, phone". Marketing is a mailing list, not data, so it's left out
  const SHORT = {
    phone: 'phone', email: 'email', birthday: 'birthday', files: 'files you uploaded', health: 'health data',
    adCookies: 'ad cookies', analyticsCookies: 'analytics cookies', loginCookies: 'login cookies', payment: 'payment card',
    orders: 'order history', account: 'account', marketing: null,
  };

  // Search matches names, categories and data types, so typing phone finds every app with your number.
  const SYNONYMS = {
    phone: 'phone number mobile cell sms text texts',
    email: 'email e-mail mail inbox address',
    birthday: 'birthday birth date of birth dob age',
    location: 'location gps where map maps place',
    contacts: 'contacts friends address book people',
    notifications: 'notifications alerts push',
    adCookies: 'cookies cookie ads ad tracking trackers',
    analyticsCookies: 'cookies cookie analytics tracking trackers',
    loginCookies: 'cookies cookie login sign in',
    health: 'health fitness heart rate steps workouts',
    photos: 'photos pictures camera roll',
    camera: 'camera',
    microphone: 'microphone mic audio voice',
    files: 'files uploads uploaded documents notes',
    marketing: 'marketing newsletter promos promo deals emails',
    orders: 'orders purchases order history',
    payment: 'payment card credit debit money',
    account: 'account',
  };
  const CATEGORY_WORDS = {
    Shopping: 'shop shopping store stores retail',
    'Clothing store': 'shop shopping store clothes clothing fashion',
    Game: 'game games gaming',
    'Study app': 'study school flashcards',
    'School portal': 'school class classes college university',
    Fitness: 'fitness workout running gym sport',
    Social: 'social friends',
    'Food delivery': 'food delivery restaurants',
    Bank: 'bank banking money finance',
    'News site': 'news',
    Rides: 'rides ride car taxi',
    Maps: 'maps map directions',
    Music: 'music songs',
    Weather: 'weather forecast',
  };
  const VERDICT_RANK = { not_needed: 0, optional: 1, needed: 2 };
  const NUDGE_PHRASE = {
    phone: ['your phone number', 'your number'],
    location: ['your location', 'your location'],
    contacts: ['your contacts', 'your contacts'],
    health: ['your health data', 'your health data'],
    birthday: ['your birthday', 'your birthday'],
    email: ['your email', 'your email'],
    adCookies: ['ad cookies on you', 'ad cookies on you'],
    analyticsCookies: ['tracking cookies on you', 'tracking cookies on you'],
    marketing: ['you on its mailing list', 'you on its mailing list'],
  };
  const HISTORY_ICON = { joined: 'user', decision: 'shield', 'take-back': 'undo', delete: 'trash', deleted: 'checkCircle', cancelled: 'x' };

  function recs() {
    return NC.receipts || null;
  }

  // Pop-ups are Umair's ui.js, so every call checks it's there first
  function toast(msg, opts) {
    return NC.ui && typeof NC.ui.toast === 'function' ? NC.ui.toast(msg, opts) : null;
  }

  function ask(opts) {
    return NC.ui && typeof NC.ui.confirm === 'function' ? NC.ui.confirm(opts) : Promise.resolve(false);
  }

  function sheet(opts) {
    return NC.ui && typeof NC.ui.sheet === 'function' ? NC.ui.sheet(opts) : null;
  }

  function app(id) {
    return NC.app ? NC.app(id) : { id, name: id, category: 'App', color: '#57534A', icon: 'globe' };
  }

  function label(type) {
    return NC.dataType ? NC.dataType(type).label : type;
  }

  function typeIcon(type) {
    return NC.dataType ? NC.dataType(type).icon : 'info';
  }

  function lower(s) {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
  }

  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function deletePath(id) {
    return '/receipts/' + id + '/delete';
  }

  // Opens the delete request with that one thing already ticked (Tri's screen reads ?pick=)
  function deleteFor(id, type) {
    return deletePath(id) + '?pick=' + encodeURIComponent(type);
  }

  // An old or mistyped receipt link goes to the list. Force, because opened from the list itself
  // go() would only redraw the list underneath and the bad link would end up on a blank screen.
  function toList() {
    NC.router.go('/receipts', { replace: true, transition: 'fade', force: true });
    return null;
  }

  function canAskDelete(id) {
    return !!(NC.router.has && NC.router.has(deletePath(id)));
  }

  function maskedDetails() {
    try {
      const r = NC.rules && typeof NC.rules.get === 'function' ? NC.rules.get() : null;
      return (r && r.masked) || {};
    } catch (e) {
      return {};
    }
  }

  // Search

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function haystack(r) {
    const R = recs();
    const a = app(r.appId);
    const parts = [a.name, String(a.id || '').replace(/-/g, ' '), a.category, a.rulesCategory, r.via,
      a.kind === 'site' ? 'site website web' : 'app', CATEGORY_WORDS[a.category] || ''];
    r.items.forEach((i) => {
      if (R.isGone(i)) return;
      parts.push(label(i.type), SYNONYMS[i.type] || '');
    });
    const tokens = norm(parts.join(' ')).split(' ').filter(Boolean);
    return { tokens, name: norm(a.name).replace(/ /g, '') };
  }

  // Optimal string alignment distance, so one typo or two swapped letters still count
  function typoDistance(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  function wordHit(word, hay) {
    if (word.length >= 3 && hay.name.indexOf(word) >= 0) return true;
    return hay.tokens.some((t) => t.indexOf(word) === 0);
  }

  function wordNear(word, hay) {
    if (word.length < 4) return false;
    return hay.tokens.concat(hay.name).some((t) => typoDistance(word, t.slice(0, word.length)) <= 1 || typoDistance(word, t) <= 1);
  }

  // Exact (prefix) matches win; only when nothing matches do we fall back to close spellings
  function search(list, q) {
    const words = norm(q).split(' ').filter(Boolean);
    const joined = words.join('');
    if (!words.length) return { list, fuzzy: false };
    const scored = list.map((r) => ({ r, hay: haystack(r) }));
    const exact = scored.filter((x) => x.hay.name.indexOf(joined) === 0 || words.every((w) => wordHit(w, x.hay)));
    if (exact.length) {
      // Names that start with what you typed go first
      const first = exact.filter((x) => x.hay.name.indexOf(joined) === 0);
      const rest = exact.filter((x) => x.hay.name.indexOf(joined) !== 0);
      return { list: first.concat(rest).map((x) => x.r), fuzzy: false };
    }
    const near = scored.filter((x) => words.every((w) => wordHit(w, x.hay) || wordNear(w, x.hay)));
    return { list: near.map((x) => x.r), fuzzy: true };
  }

  function highlight(name, q) {
    const words = norm(q).split(' ').filter((w) => w.length >= 2);
    const low = name.toLowerCase();
    for (let i = 0; i < words.length; i++) {
      const at = low.indexOf(words[i]);
      if (at >= 0) return [name.slice(0, at), h('mark.rc-hit', name.slice(at, at + words[i].length)), name.slice(at + words[i].length)];
    }
    return name;
  }

  // List pieces

  function sharedLine(r) {
    const R = recs();
    const names = [];
    r.items.forEach((i) => {
      if (SHORT[i.type] === null) return;
      const short = SHORT[i.type] || lower(label(i.type));
      // A masked number that's also in a delete request is still the masked one they hold
      if (R.holds(i)) names.push(i.prevStatus === 'masked' ? 'masked ' + short : short);
      else if (i.status === 'masked') names.push('masked ' + short);
    });
    return names.length ? 'Shared: ' + names.join(', ') : 'Nothing shared right now';
  }

  function deletionChip(r) {
    if (!r.deletion) return null;
    if (r.deletion.status === 'sent') return c.status('pending_delete');
    if (r.deletion.status === 'done') return c.chip('Data deleted', { tone: 'green', icon: 'check' });
    return null;
  }

  function receiptRow(r, q) {
    const a = app(r.appId);
    const chip = deletionChip(r);
    return c.row({
      left: c.appTile(a, { size: 44 }),
      title: q ? highlight(a.name, q) : a.name,
      subtitle: a.category + ' · ' + NC.dom.fmtDate(recs().dateOf(r), 'day'),
      // The delete chip sits under the text instead of on the right, so names never get squeezed
      meta: [h('span.rc-shared', sharedLine(r)), chip ? h('span.rc-row-chip', chip) : null],
      chevron: true,
      className: 'rc-row',
      onClick: () => NC.router.go('/receipts/' + r.id),
    });
  }

  function groupByTime(list) {
    const now = NC.dom.today();
    const groups = [];
    let cur = null;
    list.forEach((r) => {
      const d = recs().dateOf(r);
      const days = NC.dom.daysBetween(d, now);
      const key = days <= 6 ? 'This week' : NC.dom.fmtDate(d, 'month') + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
      if (!cur || cur.key !== key) {
        cur = { key, items: [] };
        groups.push(cur);
      }
      cur.items.push(r);
    });
    return groups;
  }

  function filterMatches(r, f) {
    const R = recs();
    return r.items.filter((i) => f.types.indexOf(i.type) >= 0 && !R.isGone(i));
  }

  function rowsFor(list, f) {
    const R = recs();
    const rank = (x) => Math.min.apply(null, x.items.map((i) => (R.holds(i) ? VERDICT_RANK[i.verdict] || 0 : 3)));
    return list
      .map((r) => ({ r, items: filterMatches(r, f) }))
      .filter((x) => x.items.length)
      .sort((a, b) => rank(a) - rank(b) || recs().dateOf(b.r) - recs().dateOf(a.r));
  }

  function filterRow(x, f) {
    const R = recs();
    const a = app(x.r.appId);
    const live = x.items.filter(R.holds).sort((p, q) => (VERDICT_RANK[p.verdict] || 0) - (VERDICT_RANK[q.verdict] || 0));
    const lead = live[0] || x.items[0];
    let sub = lead.note || label(lead.type);
    if (f.id === 'cookies') sub = cap(NC.dom.listText(x.items.map((i) => lower(label(i.type)))));
    return c.row({
      left: c.appTile(a, { size: 44 }),
      title: a.name,
      subtitle: sub,
      right: live[0] ? c.verdict(live[0].verdict) : c.status(lead.status),
      className: 'rc-frow',
      onClick: () => NC.router.go('/receipts/' + x.r.id),
    });
  }

  function summaryText(f, rows) {
    const R = recs();
    const heldAs = (x, verdict) => x.items.some((i) => R.holds(i) && i.verdict === verdict);
    const real = rows.filter((x) => x.items.some(R.holds));
    // Counted the same way as the chip on each row, so Optional never reads as "doesn't need it"
    const extra = real.filter((x) => heldAs(x, 'not_needed'));
    const optional = real.filter((x) => !heldAs(x, 'not_needed') && heldAs(x, 'optional'));
    const done = rows.filter((x) => !x.items.some(R.holds));
    const n = real.length;
    const m = extra.length;
    const k = optional.length;
    const cookies = f.id === 'cookies';
    let title;
    if (cookies) title = n ? NC.dom.plural(n, 'site') + (n === 1 ? ' keeps' : ' keep') + ' cookies on you' : 'No sites keep cookies on you';
    else title = n ? NC.dom.plural(n, 'app') + (n === 1 ? ' has ' : ' have ') + f.noun : 'No apps have ' + f.noun;
    const it = cookies ? 'to' : 'it';
    let sub;
    let tone = 'green';
    if (!n) sub = 'Nothing to take back here';
    else if (m) {
      tone = 'red';
      sub = n === 1 ? 'It doesn\'t need ' + it : m + ' of them ' + (m === 1 ? 'doesn\'t' : 'don\'t') + ' need ' + it;
      if (k) sub += ', it\'s optional for ' + k + ' more';
    } else if (k) {
      tone = 'amber';
      sub = 'It\'s optional for ' + (n === 1 ? app(real[0].r.appId).name : k + ' of them');
    } else sub = n === 1 ? 'It needs ' + (cookies ? 'them' : 'it') + ' to work' : 'They all need ' + (cookies ? 'them' : 'it') + ' to work';
    const note = done.length ? 'Already taken back: ' + NC.dom.listText(done.map((x) => app(x.r.appId).name)) : null;
    return { title, sub, tone, note };
  }

  function summaryCard(f, s) {
    return c.card(h('div.rc-sum',
      h('span.rc-sum-icon', NC.icon(f.icon, { size: 24 })),
      h('div.rc-sum-text',
        h('p.rc-sum-title', s.title),
        h('p', { class: ['rc-sum-sub', 'rc-sum-sub--' + s.tone] }, s.sub),
        s.note ? h('p.rc-sum-note', s.note) : null)), { tone: 'cream', className: 'rc-sum-card' });
  }

  // Home card and the yellow "Still needed?" card both come from here

  function nudgeFor(r) {
    const item = recs().staleItem(r);
    const a = app(r.appId);
    const phrase = (item && NUDGE_PHRASE[item.type]) || ['your ' + lower(label(item ? item.type : 'account')), 'your data'];
    return {
      title: a.name + ' has ' + phrase[0],
      text: a.name + ' hasn\'t been opened in ' + r.openedDaysAgo + ' days but has ' + phrase[1] + '.',
      days: r.openedDaysAgo,
    };
  }

  function staleList() {
    const R = recs();
    if (!R) return [];
    const s = R.slice();
    if (!s) return [];
    const dismissed = s.nudgesDismissed || [];
    return R.all().filter((r) => R.isStale(r) && dismissed.indexOf(r.id) < 0)
      .sort((a, b) => b.openedDaysAgo - a.openedDaysAgo);
  }

  function dismissNudge(id, focusTarget) {
    const a = app(id);
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    recs().updateSlice((s) => {
      s.nudgesDismissed = (s.nudgesDismissed || []).filter((x) => x !== id).concat(id);
    });
    toast('Hidden. You can still find ' + a.name + ' in your list.', {
      tone: 'info',
      action: {
        label: 'Undo',
        onClick: () => recs().updateSlice((s) => {
          s.nudgesDismissed = (s.nudgesDismissed || []).filter((x) => x !== id);
        }),
      },
    });
  }

  function nudgeBanner(r, heading) {
    const n = nudgeFor(r);
    const a = app(r.appId);
    const close = c.iconButton('x', { label: 'Hide this for ' + a.name, className: 'rc-nudge-x', size: 18, onClick: () => dismissNudge(r.id, heading) });
    const review = c.button('Review', {
      variant: 'secondary',
      small: true,
      block: false,
      className: 'btn--pill',
      ariaLabel: 'Review ' + a.name,
      onClick: () => NC.router.go('/receipts/' + r.id),
    });
    return c.banner({
      icon: 'clock',
      tone: 'amber',
      title: 'Still needed?',
      text: n.text,
      action: h('div.rc-nudge-actions', close, review),
      className: 'rc-nudge',
    });
  }

  // Same look as the one-time tip on the Rules tab, so the two tabs feel like one app
  function tipCard(heading) {
    const hide = () => {
      if (heading) heading.focus({ preventScroll: true });
      recs().updateSlice((s) => {
        s.tipDismissed = true;
      });
    };
    return c.banner({
      icon: 'sparkle',
      tone: 'white',
      className: 'rc-tip',
      text: 'Every time you say yes to an app, a receipt lands here.',
      action: c.iconButton('x', { label: 'Hide this tip', onClick: hide }),
    });
  }

  // The list screen

  function renderList(params, query) {
    const R = recs();
    const qs = query || {};
    // ?q=wal and ?filter=phone fill the screen in, then we drop them from the address
    if (qs.q != null || qs.filter != null) {
      if (qs.q != null) {
        view.q = String(qs.q);
        view.searching = !!view.q;
      }
      if (qs.filter && FILTERS.some((f) => f.id === qs.filter)) {
        view.filter = qs.filter;
        view.searching = false;
        view.q = '';
      }
      // Force, because we might already be on /receipts and go() would just refresh it
      NC.router.go('/receipts', { replace: true, transition: 'none', force: true });
      return null;
    }

    const heading = c.title('Receipts');
    // An id and tabindex let the router put focus back on it after the tip or nudge is hidden
    heading.id = 'rc-title';
    heading.setAttribute('tabindex', '-1');
    const s = R ? R.slice() : null;
    if (!R || !s) {
      return c.screen({
        className: 'rc-list',
        body: [heading, c.empty({ icon: 'receipt', title: 'No receipts yet', text: 'Log in to see everything you\'ve agreed to.' })],
      });
    }
    const all = R.all();

    const results = h('div.rc-results');
    const status = h('p.sr-only', { 'aria-live': 'polite', role: 'status' });
    const input = h('input.field-input.rc-search-input', {
      id: 'rc-search',
      type: 'search',
      placeholder: 'Search apps',
      'aria-label': 'Search receipts',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      enterkeyhint: 'search',
      value: view.q,
    });
    const clearBtn = c.iconButton('x', { label: 'Clear search', size: 14, className: 'rc-search-clear' });
    const cancelBtn = h('button.rc-cancel', { type: 'button' }, 'Cancel');
    const chips = FILTERS.map((f) => {
      const count = f.types ? rowsFor(all, f).length : null;
      const chip = c.filterChip(f.label, {
        selected: view.filter === f.id,
        count,
        onClick: () => {
          view.filter = f.id;
          chips.forEach((x, i) => x.setSelected(FILTERS[i].id === f.id));
          chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          paint();
        },
      });
      chip.setAttribute('aria-label', f.label === 'Phone #' ? 'Phone number' : f.label);
      if (count != null) chip.setAttribute('aria-label', chip.getAttribute('aria-label') + ', ' + NC.dom.plural(count, 'app'));
      return chip;
    });

    const top = h('div.rc-top', h('div.rc-top-inner',
      heading,
      h('p.lead.rc-lead', 'Everything you\'ve agreed to, in one place.'),
      s.tipDismissed ? null : tipCard(heading)));
    const screen = c.screen({
      className: 'rc-list',
      body: [
        top,
        h('div.rc-search',
          h('div.rc-search-box',
            h('span.rc-search-icon', NC.icon('search', { size: 22 })),
            input,
            clearBtn),
          cancelBtn),
        h('div.fchips.rc-chips', { role: 'group', 'aria-label': 'Filter receipts' }, chips),
        results,
        status,
      ],
    });
    if (view.searching) screen.classList.add('is-searching');

    function syncClear() {
      clearBtn.hidden = !view.q;
    }

    function enterSearch() {
      if (view.searching) return;
      view.searching = true;
      screen.classList.add('is-searching');
      paint();
    }

    // keepFocus is for keyboard users: focus stays in the box (which doesn't reopen search),
    // while a tap closes the phone keyboard
    function exitSearch(keepFocus) {
      view.searching = false;
      view.q = '';
      input.value = '';
      if (keepFocus) input.focus();
      else input.blur();
      screen.classList.remove('is-searching');
      syncClear();
      paint();
    }

    function setQuery(q, focus) {
      view.q = q;
      input.value = q;
      syncClear();
      paint();
      if (focus) input.focus();
    }

    // Only a tap or typing opens search mode. Tabbing through just passes the box, so the
    // filter chips after it stay reachable from the keyboard
    let viaPointer = false;
    input.addEventListener('pointerdown', () => {
      if (document.activeElement === input) enterSearch();
      else viaPointer = true;
    });
    input.addEventListener('pointercancel', () => {
      viaPointer = false;
    });
    input.addEventListener('focus', () => {
      if (viaPointer) enterSearch();
      viaPointer = false;
    });
    input.addEventListener('input', () => {
      view.q = input.value;
      if (!view.searching) enterSearch();
      syncClear();
      paint();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitSearch(true);
      }
    });
    clearBtn.addEventListener('click', () => setQuery('', true));
    // A click from Enter or Space has detail 0
    cancelBtn.addEventListener('click', (e) => exitSearch(e.detail === 0));
    syncClear();

    function paint() {
      NC.dom.clear(results);
      if (view.searching) paintSearch();
      else if (view.filter !== 'all') paintFilter();
      else paintAll();
    }

    function paintAll() {
      if (!all.length) {
        results.appendChild(c.empty({ icon: 'receipt', title: 'No receipts yet', text: 'When you say yes to an app or site, a receipt lands here.' }));
        status.textContent = 'No receipts yet';
        return;
      }
      const stale = staleList()[0];
      if (stale) results.appendChild(nudgeBanner(stale, heading));
      groupByTime(all).forEach((g) => {
        results.appendChild(c.section(g.key, c.list(g.items.map((r) => receiptRow(r)), { className: 'rc-rows' }), { className: 'rc-group' }));
      });
      status.textContent = 'Showing all ' + NC.dom.plural(all.length, 'receipt');
    }

    function paintFilter() {
      const f = FILTERS.find((x) => x.id === view.filter) || FILTERS[0];
      const rows = rowsFor(all, f);
      const sum = summaryText(f, rows);
      results.appendChild(summaryCard(f, sum));
      if (rows.length) results.appendChild(c.list(rows.map((x) => filterRow(x, f)), { className: 'rc-frows' }));
      status.textContent = sum.title + '. ' + sum.sub + '.';
    }

    function paintSearch() {
      if (!view.q.trim()) {
        results.appendChild(h('div.rc-suggest',
          h('p.label', 'Try searching for'),
          h('div.rc-suggest-row', ['phone', 'birthday', 'location', 'shopping', 'cookies'].map((w) =>
            h('button.fchip.rc-suggest-chip', { type: 'button', onClick: () => setQuery(w) }, NC.icon('search', { size: 14 }), w)))));
        results.appendChild(c.section(NC.dom.plural(all.length, 'receipt'), c.list(all.map((r) => receiptRow(r)), { className: 'rc-rows' }), { className: 'rc-group' }));
        status.textContent = '';
        return;
      }
      const found = search(all, view.q);
      if (!found.list.length) {
        results.appendChild(c.empty({
          icon: 'search',
          title: 'No receipts match “' + view.q.trim() + '”',
          text: 'Try an app name like Walmart, or a kind of data like phone or birthday.',
          action: c.button('Clear search', { variant: 'secondary', small: true, block: false, onClick: () => setQuery('', true) }),
        }));
        status.textContent = 'No receipts match ' + view.q.trim();
        return;
      }
      const countText = NC.dom.plural(found.list.length, 'receipt');
      const title = found.fuzzy ? 'Close matches for “' + view.q.trim() + '”' : countText;
      results.appendChild(c.section(title, c.list(found.list.map((r) => receiptRow(r, found.fuzzy ? '' : view.q)), { className: 'rc-rows' }), { className: 'rc-group' }));
      status.textContent = countText + (found.fuzzy ? ', close matches' : '');
    }

    paint();
    return screen;
  }

  // One receipt

  // "Joined today" but "Joined Sep 12"
  function dayText(d) {
    const s = NC.dom.fmtDate(d, 'day');
    return s === 'Today' || s === 'Yesterday' ? s.toLowerCase() : s;
  }

  function headMeta(r, a) {
    const verb = { 'Sign-up': 'Joined', 'App permissions': 'Installed', 'Cookie banner': 'Visited' }[r.via] || 'Agreed';
    const parts = [a.category, verb + ' ' + dayText(r.agreedAt)];
    if (r.lastAgreedAt && NC.dom.daysBetween(r.agreedAt, r.lastAgreedAt) > 0) parts.push('Updated ' + dayText(r.lastAgreedAt));
    if (r.openedDaysAgo >= 14) parts.push('Not opened in ' + r.openedDaysAgo + ' days');
    // Each part stays whole, so the line only breaks at a dot
    const out = [];
    parts.forEach((part, i) => {
      if (i) out.push(' · ');
      out.push(h('span.rc-nowrap', part));
    });
    return out;
  }

  function itemRow(i) {
    let sub = null;
    // Still masked while a delete request for it is out, so keep showing the stand-in
    if (i.status === 'masked' || (i.status === 'pending_delete' && i.prevStatus === 'masked')) {
      // Showing the stand-in itself is the quickest way to explain what "masked" means
      const m = maskedDetails();
      if (i.type === 'phone') sub = m.phone ? ['Gets ', h('span.rc-nowrap', m.phone)] : 'Gets your masked number';
      else if (i.type === 'email') sub = m.email ? ['Gets ', h('span.rc-break', m.email)] : 'Gets your masked email';
    }
    return c.row({
      left: h('span.rc-item-icon', NC.icon(typeIcon(i.type), { size: 22 })),
      title: label(i.type),
      subtitle: sub,
      right: i.status === 'shared' ? c.verdict(i.verdict) : c.status(i.status),
      className: 'rc-item',
    });
  }

  function practicesCard(p) {
    const pr = p || {};
    const kv = (k, v) => [h('dt', k), h('dd', v || 'Not listed')];
    return c.card([
      h('h3.label.rc-card-label', 'What they do with it'),
      h('dl.rc-kv', kv('Kept for', pr.keptFor), kv('Shared with', pr.sharedWith), kv('Used for', pr.usedFor)),
    ], { className: 'rc-card' });
  }

  function addDays(isoDate, n) {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + n);
    return d;
  }

  // Closing Tri's "Request sent" screen early used to lose its "Make this a rule?" card, so the
  // tracker links back to it. Only these categories have a rule there: the id matches Tri's RULE_FOR
  // ids in requests.js ('shopping-masked' and so on)
  const RULE_CATEGORIES = ['shopping', 'food', 'games', 'social', 'news'];

  function ruleOffer(r, a) {
    const path = '/receipts/' + r.id + '/delete/sent';
    if (!r.deletion || r.deletion.status !== 'sent' || RULE_CATEGORIES.indexOf(a.rulesCategory) < 0) return null;
    if (!NC.router.has(path) || !NC.rules || typeof NC.rules.hasCustom !== 'function' || typeof NC.rules.addCustom !== 'function') return null;
    if (NC.rules.hasCustom(a.rulesCategory + '-masked')) return null;
    return h('button.link', { type: 'button', onClick: () => NC.router.go(path) }, NC.icon('sparkle', { size: 18 }), 'Make this a rule?');
  }

  function trackerCard(r, a) {
    const d = r.deletion;
    const R = recs();
    const words = (d.items || []).filter((t) => t !== 'account').map((t) => lower(label(t)));
    const closing = (d.items || []).indexOf('account') >= 0;
    const asked = [];
    if (words.length) asked.push('your ' + NC.dom.listText(words));
    if (closing) asked.push('your whole account');
    if (d.status === 'done') {
      return c.card(h('div.rc-track-head',
        c.iconTile('check', { tone: 'white-green', size: 40 }),
        h('div',
          h('p.card-title', a.name + ' deleted your data'),
          h('p.card-text', 'Confirmed ' + NC.dom.fmtDate(d.doneAt || new Date(), 'short') + '.' +
            (asked.length ? ' ' + cap(NC.dom.listText(asked)) + (words.length + (closing ? 1 : 0) > 1 ? ' are' : ' is') + ' gone.' : '')))), { tone: 'green', className: 'rc-track' });
    }
    const due = d.dueDays || 45;
    const used = Math.max(0, NC.dom.daysBetween(d.sentAt, NC.dom.today()));
    const left = due - used;
    const leftText = left > 0 ? NC.dom.plural(left, 'day') + ' left' : left === 0 ? 'Due today' : NC.dom.plural(-left, 'day') + ' past their deadline';
    const pct = Math.min(100, Math.round((used / due) * 100));

    const replied = () => ask({
      title: 'Did ' + a.name + ' delete your data?',
      message: asked.length ? 'We\'ll mark ' + NC.dom.listText(asked) + ' as deleted.' : 'We\'ll mark your request as done.',
      confirmLabel: 'Yes, it\'s deleted',
      cancelLabel: 'Not yet',
      icon: 'checkCircle',
    }).then((ok) => {
      if (!ok) return;
      R.update(r.id, (rec) => {
        rec.deletion.status = 'done';
        rec.deletion.doneAt = new Date().toISOString();
        rec.items.forEach((i) => {
          if (i.status === 'pending_delete') i.status = 'deleted';
        });
        rec.history.push({ id: 'h' + Date.now().toString(36), at: new Date().toISOString(), kind: 'deleted', text: a.name + ' confirmed your data was deleted' });
      });
      receiptToast('Marked as deleted. Nice work.', null, r.id);
    });

    const cancel = () => ask({
      title: 'Cancel your delete request?',
      message: 'We\'ll stop tracking it. ' + a.name + ' may still act on the email you already sent.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      danger: true,
      icon: 'trash',
    }).then((ok) => {
      if (!ok) return;
      R.update(r.id, (rec) => {
        rec.deletion.status = 'cancelled';
        rec.deletion.cancelledAt = new Date().toISOString();
        rec.items.forEach((i) => {
          if (i.status === 'pending_delete') i.status = R.restoreStatus(rec, i);
        });
        rec.history.push({ id: 'h' + Date.now().toString(36), at: new Date().toISOString(), kind: 'cancelled', text: 'You cancelled the delete request' });
      });
      receiptToast('Delete request cancelled', { tone: 'info' }, r.id);
    });

    const showEmail = () => sheet({
      title: 'The email you sent',
      body: [
        h('p.rc-mail-meta', 'To ' + (a.contact || a.name) + ' · ' + NC.dom.fmtDate(d.sentAt, 'long')),
        h('div.rc-mail', d.message || 'Your request to delete your data.'),
      ],
      footer: (sh) => c.button('Done', { variant: 'dark', onClick: () => sh.close('button') }),
    });

    const offer = ruleOffer(r, a);
    const links = [
      d.message ? h('button.link', { type: 'button', onClick: showEmail }, NC.icon('mail', { size: 18 }), 'See the email you sent') : null,
      offer,
    ].filter(Boolean);

    return c.card([
      h('div.rc-track-head',
        c.iconTile('clock', { tone: 'amber', size: 40 }),
        h('div',
          // The date and the days left never split across lines on narrow phones
          h('p.card-title', 'Delete request sent ', h('span.rc-nowrap', NC.dom.fmtDate(d.sentAt, 'short'))),
          h('p.card-text', 'Waiting for a reply · ', h('span.rc-nowrap', leftText)))),
      h('div.rc-track-bar', { role: 'progressbar', 'aria-label': 'Time ' + a.name + ' has to reply', 'aria-valuemin': 0, 'aria-valuemax': due, 'aria-valuenow': Math.min(used, due), 'aria-valuetext': leftText },
        h('span', { style: { width: pct + '%' } })),
      h('ul.rc-track-facts',
        asked.length ? h('li', NC.icon('trash', { size: 18 }), 'Asked to delete ' + NC.dom.listText(asked)) : null,
        d.remind ? h('li', NC.icon('bell', { size: 18 }), 'Reminder on ' + NC.dom.fmtDate(addDays(d.sentAt, due), 'short') + ' if they don\'t reply') : null),
      links.length ? h('div.rc-track-links', links) : null,
      h('div.btn-row.rc-track-btns',
        c.button('They replied', { variant: 'secondary', small: true, onClick: replied }),
        c.button('Cancel request', { variant: 'danger', small: true, onClick: cancel })),
    ], { className: 'rc-track' });
  }

  function historySection(r) {
    const list = r.history.slice().sort((a, b) => new Date(b.at) - new Date(a.at));
    if (!list.length) return null;
    return c.section('History', c.card(c.list(list.map((e) => c.row({
      left: c.iconTile(HISTORY_ICON[e.kind] || (/delete/i.test(e.text) ? 'trash' : 'clock'), { tone: 'cream', size: 32 }),
      title: e.text,
      subtitle: NC.dom.fmtDate(e.at, 'day'),
      className: 'rc-hist',
    })))), { className: 'rc-history' });
  }

  // A toast on a receipt sits right under the nav. The receipt makes room for it at the top, so the
  // header moves down instead of hiding behind it (like the DP3 Walmart receipt)
  function toastLive(el) {
    return !!(el && el.isConnected && !el.classList.contains('is-out'));
  }

  function receiptScreen(path) {
    const cur = NC.router.current ? NC.router.current() : null;
    if (!cur || cur.path !== path) return null;
    return document.querySelector('#view > .screen.rc-detail:last-child');
  }

  function makeRoom(screen) {
    const body = screen && screen.querySelector('.screen-body');
    const el = roomFor && roomFor.el;
    if (!body || !toastLive(el)) return;
    const old = body.querySelector(':scope > .rc-toast-room');
    if (old && old.ncToast === el) return;
    if (old) old.remove();
    const room = h('div.rc-toast-room', { 'aria-hidden': 'true' });
    room.ncToast = el;
    room.style.height = (el.offsetHeight + 10) + 'px';
    body.insertBefore(room, body.firstChild);
    // The room closes up as soon as the toast starts leaving
    const watch = new MutationObserver(() => {
      if (toastLive(el)) return;
      room.classList.add('is-gone');
      watch.disconnect();
    });
    watch.observe(el, { attributes: true, attributeFilter: ['class'] });
    if (el.parentNode) watch.observe(el.parentNode, { childList: true });
    // The receipt we came back to may be scrolled down, so bring the header into view once per toast
    if (roomFor.toTop) {
      roomFor.toTop = false;
      const path = roomFor.path;
      requestAnimationFrame(() => {
        const shown = receiptScreen(path);
        const b = shown && shown.querySelector('.screen-body');
        if (b) b.scrollTop = 0;
      });
    }
  }

  function receiptToast(msg, opts, id, toTop) {
    const t = toast(msg, opts);
    const path = '/receipts/' + id;
    roomFor = t && t.el ? { path, el: t.el, toTop: !!toTop } : null;
    if (roomFor) makeRoom(receiptScreen(path));
    return t;
  }

  function renderReceipt(p) {
    const R = recs();
    const r = R && R.get(p.id);
    if (!r) return toList();
    const a = app(r.appId);
    const have = r.items.filter((i) => !R.isGone(i));
    const gone = r.items.filter((i) => R.isGone(i));
    const canTake = R.takeBackOptions(r).length > 0;
    const anyHeld = r.items.some((i) => !R.isGone(i));
    const d = r.deletion;
    const tracking = d && (d.status === 'sent' || d.status === 'done');
    const canDelete = canAskDelete(r.id) && (!tracking || (d.status === 'done' && anyHeld));
    const choosePath = r.requestId ? '/check/' + r.requestId + '/choose' : null;
    const canChange = !!(choosePath && NC.router.has(choosePath));

    const actions = [];
    if (canTake) actions.push(c.button('Take back access', { onClick: () => NC.router.go('/receipts/' + r.id + '/take-back') }));
    if (canChange) actions.push(c.button('Change what ' + a.name + ' gets', { variant: 'secondary', onClick: () => NC.router.go(choosePath) }));
    if (canDelete) {
      const solo = !canTake && !canChange;
      actions.push(c.button('Ask them to delete my data', {
        variant: solo ? 'primary' : 'secondary',
        icon: solo ? 'trash' : null,
        onClick: () => NC.router.go(deletePath(r.id)),
      }));
    }

    const screen = c.screen({
      className: 'rc-detail',
      nav: c.navBar({ title: 'Receipt', back: '/receipts' }),
      body: [
        h('div.rc-head',
          c.appTile(a, { size: 60 }),
          h('div.rc-head-text',
            c.title(a.name, { size: 'lg', as: 'h2', className: 'rc-name' }),
            h('p.rc-head-meta', headMeta(r, a)))),
        h('div.rc-cards',
          tracking ? trackerCard(r, a) : null,
          c.card([
            h('h3.label.rc-card-label', 'They have:'),
            have.length ? c.list(have.map(itemRow), { className: 'rc-items' }) : h('p.rc-none', 'Nothing right now.'),
          ], { className: 'rc-card' }),
          gone.length ? c.card([
            h('h3.label.rc-card-label', 'They don\'t have:'),
            c.list(gone.map(itemRow), { className: 'rc-items' }),
          ], { className: 'rc-card' }) : null,
          practicesCard(r.practices),
          actions.length ? h('div.rc-actions', actions) : null),
        historySection(r),
      ],
    });
    if (roomFor && roomFor.path === '/receipts/' + r.id) makeRoom(screen);
    return screen;
  }

  // Take back access

  NC.router.onChange((cur) => {
    // A search stays while you hop in and out of receipts, but leaving the tab clears it
    if (cur && cur.path.indexOf('/receipts') !== 0) {
      view.q = '';
      view.searching = false;
    }
    // Undo only makes sense while you're looking at that receipt, not halfway through a delete request
    if (undoToast && (!cur || cur.path !== undoToast.path)) {
      undoToast.toast.close();
      undoToast = null;
    }
  });

  // After applying we only go "back" if the receipt really is the screen behind this one.
  // Danyal's router keeps that trail, an older one without backTo just swaps the screen
  function leaveTo(path) {
    if (typeof NC.router.backTo === 'function') NC.router.backTo(path);
    else NC.router.go(path, { replace: true, transition: 'back' });
  }

  function reviewLabel(o) {
    return o.takeBack.label.replace(/\bmy\b/g, 'your');
  }

  function reviewHint(o, a) {
    const m = maskedDetails();
    if (o.takeBack.action === 'mask' && o.type === 'phone' && m.phone) return a.name + ' gets ' + m.phone + ' instead of your real number';
    if (o.takeBack.action === 'mask' && o.type === 'email' && m.email) return a.name + ' gets ' + m.email + ' instead of your real email';
    return o.takeBack.hint;
  }

  function stuckSheet(i, a, id) {
    const what = 'your ' + lower(label(i.type));
    sheet({
      title: 'Why can\'t I take this back?',
      body: [
        h('p.rc-sheet-text', a.name + ' already saved ' + what + '. Switching things off only stops new sharing, it doesn\'t erase what they have.'),
        h('p.rc-sheet-text', 'To get it erased, send ' + a.name + ' a delete request. We\'ll write it for you.'),
      ],
      footer: (sh) => [
        canAskDelete(id) ? c.button('Ask ' + a.name + ' to delete it', { onClick: () => { sh.close('api'); NC.router.go(deleteFor(id, i.type)); } }) : null,
        c.button('Got it', { variant: canAskDelete(id) ? 'ghost' : 'dark', onClick: () => sh.close('button') }),
      ],
    });
  }

  function renderTakeBack(p) {
    const R = recs();
    const r = R && R.get(p.id);
    if (!r) return toList();
    const a = app(r.appId);
    const back = '/receipts/' + r.id;
    const nav = c.navBar({ title: 'Take back access', back });
    const opts = R.takeBackOptions(r);
    const stuck = R.stuckItems(r);
    const kept = r.items.filter((i) => i.status === 'shared' && i.verdict === 'needed');

    if (!opts.length) {
      return c.screen({
        className: 'rc-take',
        nav,
        body: c.empty({
          icon: 'check',
          tone: 'green',
          title: 'Nothing left to take back',
          text: a.name + ' only has what it needs, or things only a delete request can remove.',
          action: c.button('Back to the receipt', { variant: 'secondary', small: true, block: false, onClick: () => NC.router.back(back) }),
        }),
      });
    }

    const types = opts.map((o) => o.type);
    let picked = draft && draft.id === r.id ? draft.picked.filter((t) => types.indexOf(t) >= 0) : opts.filter((o) => o.takeBack.recommended).map((o) => o.type);
    draft = { id: r.id, picked };
    const boxes = {};

    const applyBtn = c.button('Apply changes', { disabled: !picked.length, onClick: () => review() });
    const allBtn = h('button.link.rc-take-all', { type: 'button', onClick: () => setAll(picked.length < opts.length) });
    const tip = h('p.rc-take-tip');
    const need = h('p.rc-take-need', { hidden: !!picked.length, 'aria-live': 'polite' }, 'Tick at least one thing to continue.');
    const recommended = opts.filter((o) => o.takeBack.recommended).map((o) => o.type);
    const anyRecommended = recommended.length > 0;

    // "We ticked" is only true while the ticks are still ours, after Clear it says what to do instead
    function sync() {
      draft.picked = picked;
      applyBtn.disabled = !picked.length;
      need.hidden = !!picked.length;
      allBtn.textContent = picked.length < opts.length ? 'Select all' : 'Clear';
      const ours = anyRecommended && picked.length === recommended.length && recommended.every((t) => picked.indexOf(t) >= 0);
      tip.textContent = ours ? 'We ticked what ' + a.name + ' doesn\'t need.' : 'Tick what ' + a.name + ' should stop getting.';
    }

    function setAll(on) {
      picked = on ? types.slice() : [];
      Object.keys(boxes).forEach((t) => boxes[t].setOn(on, true));
      sync();
    }

    const rows = opts.map((o) => {
      const tid = NC.dom.uid('tb-title');
      const hid = NC.dom.uid('tb-hint');
      const box = c.checkbox({
        checked: picked.indexOf(o.type) >= 0,
        labelledBy: tid,
        describedBy: hid,
        onChange: (on) => {
          picked = on ? picked.concat(o.type) : picked.filter((t) => t !== o.type);
          sync();
        },
      });
      boxes[o.type] = box;
      const iconName = o.takeBack.action === 'mask' ? 'mask' : typeIcon(o.type);
      // The whole row is a big tap target for the checkbox, like a settings list
      return h('div.rc-tb-row', { onClick: (e) => { if (!e.target.closest('.checkbox')) box.click(); } },
        c.iconTile(iconName, { tone: 'cream', shape: 'square', size: 40 }),
        h('div.rc-tb-main', h('p.rc-tb-title', { id: tid }, o.takeBack.label), h('p.rc-tb-hint', { id: hid }, o.takeBack.hint)),
        box);
    });

    const stuckRows = stuck.map((i) => h('div.rc-tb-row.is-stuck',
      c.iconTile(typeIcon(i.type), { tone: 'cream', shape: 'square', size: 40 }),
      h('div.rc-tb-main',
        h('p.rc-tb-title', label(i.type)),
        h('p.rc-tb-hint', i.stuck || 'Can\'t be taken back here. Ask ' + a.name + ' to delete it instead.'),
        canAskDelete(r.id) ? h('button.link.rc-tb-link', { type: 'button', onClick: () => NC.router.go(deleteFor(r.id, i.type)) }, 'Ask ' + a.name + ' to delete it', NC.icon('chev', { size: 16 })) : null),
      c.iconButton('info', { label: 'Why can\'t I take back my ' + lower(label(i.type)) + '?', size: 22, className: 'rc-tb-info', onClick: () => stuckSheet(i, a, r.id) })));

    const keptText = kept.length
      ? a.name + ' keeps ' + NC.dom.listText(kept.map((i) => 'your ' + lower(label(i.type)))) + ', because it needs ' + (kept.length === 1 ? 'it' : 'them') + ' to work.'
      : null;

    function review() {
      const chosen = opts.filter((o) => picked.indexOf(o.type) >= 0);
      if (!chosen.length) return;
      const n = chosen.length;
      sheet({
        title: 'Review your changes',
        className: 'rc-review',
        body: [
          h('p.rc-review-lead', 'You\'re about to:'),
          h('ul.rc-review-list', chosen.map((o) => h('li.rc-review-item',
            c.iconTile(o.takeBack.action === 'mask' ? 'mask' : typeIcon(o.type), { tone: 'green', size: 36 }),
            h('div',
              h('p.rc-review-title', reviewLabel(o)),
              h('p.rc-review-hint', reviewHint(o, a)))))),
          h('p.rc-review-note', NC.icon('undo', { size: 16 }), 'You can undo this right after.'),
        ],
        footer: (sh) => [
          c.button('Apply ' + NC.dom.plural(n, 'change'), { onClick: () => apply(sh, chosen) }),
          c.button('Cancel', { variant: 'ghost', onClick: () => sh.close('button') }),
        ],
      });
    }

    function apply(sh, chosen) {
      const result = R.applyTakeBack(r.id, chosen.map((o) => o.type));
      sh.close('api');
      if (!result) {
        toast('That didn\'t work. Try again.', { tone: 'error' });
        return;
      }
      draft = null;
      NC.dom.haptic(15);
      const n = result.changes.length;
      leaveTo(back);
      const t = receiptToast('Done. ' + NC.dom.plural(n, 'change') + ' applied.', {
        action: {
          label: 'Undo',
          onClick: () => {
            undoToast = null;
            R.undoTakeBack(result);
            receiptToast(a.name + ' has ' + (n === 1 ? 'it' : 'them') + ' again. Changes undone.', { tone: 'info' }, r.id, true);
          },
        },
      }, r.id, true);
      undoToast = t && t.close ? { path: back, toast: t } : null;
    }

    sync();
    return c.screen({
      className: 'rc-take',
      nav,
      body: [
        c.title('What should ' + a.name + ' stop getting?', { size: 'lg', as: 'h2', className: 'rc-take-title' }),
        h('p.lead.rc-take-lead', r.takeBackNote || 'Your ' + a.name + ' account keeps working.'),
        h('div.rc-take-tools', tip, allBtn),
        c.card(h('div.rc-tb-list', rows, stuckRows), { className: 'rc-tb-card' }),
        keptText ? h('p.rc-take-kept', keptText) : null,
      ],
      // The same hint as Tri's delete screen, so a grayed out button never goes unexplained
      footer: [need, applyBtn],
    });
  }

  // Home card: "Walmart has your phone number"

  function homeCard(r) {
    const a = app(r.appId);
    const n = nudgeFor(r);
    const card = c.card(c.row({
      left: c.appTile(a, { size: 52 }),
      title: n.title,
      subtitle: 'Haven\'t opened in ' + n.days + ' days',
      chevron: true,
      onClick: () => NC.router.go('/receipts/' + r.id),
    }), { pad: false, className: 'rc-home-card' });
    card.classList.add('card--raised');
    return card;
  }

  function resetView() {
    view.q = '';
    view.filter = 'all';
    view.searching = false;
    draft = null;
    if (undoToast) undoToast.toast.close();
    undoToast = null;
    roomFor = null;
  }

  NC.router.addTab({ id: 'receipts', label: 'Receipts', icon: 'receipt', path: '/receipts', order: 3 });

  NC.router.add('/receipts', { tab: 'receipts', title: 'Receipts', live: true, render: renderList });
  NC.router.add('/receipts/:id', {
    tab: 'receipts',
    title: (p) => app(p.id).name + ' receipt',
    live: true,
    render: renderReceipt,
  });
  // No live redraw here, the ticks would reset under your thumb
  NC.router.add('/receipts/:id/take-back', { tab: null, title: 'Take back access', render: renderTakeBack });

  NC.hooks.add('home-cards', () => {
    if (!recs() || !NC.store || !NC.store.currentUser()) return null;
    return staleList().map((r, i) => ({ id: 'receipt-nudge-' + r.id, priority: 20 + i, el: homeCard(r) }));
  });

  NC.hooks.add('data-reset', resetView);
  // A different person logging in shouldn't see the last search
  if (NC.store && NC.store.on) {
    NC.store.on((name) => {
      if (name === '*') resetView();
    });
  }
})();
