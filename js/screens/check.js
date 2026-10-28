// Task 1: checking what an app asks for. The Home request cards, the requests inbox, the review sheet
// over the app, the Why pop-up, "Choose for myself" and the done screen all live here.
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.dom || !NC.c || !NC.router) return;
  const { h } = NC.dom;
  const c = NC.c;

  const STEPS = { review: 1, choose: 2, done: 3 };
  const TILE_TONE = { needed: 'green', optional: 'amber', not_needed: 'red' };
  const VERDICT_WORD = { needed: 'needed', optional: 'optional', not_needed: 'not needed' };
  const GAMES_RULE = {
    id: 'games-needed-only',
    category: 'games',
    icon: 'game',
    title: 'Games',
    desc: 'Only what they need to run. No location or contacts.',
  };
  // How the "Why does X want ..." question reads for each kind of data
  const WANT_PHRASE = {
    notifications: 'to send you notifications',
    adCookies: 'to use ad cookies',
    analyticsCookies: 'to use analytics cookies',
    loginCookies: 'to use login cookies',
    marketing: 'to send you marketing emails',
    camera: 'to use your camera',
    microphone: 'to use your microphone',
  };
  const UNDO_MINUTES = 15;

  // The "Choices saved" toast, plus which request its Undo belongs to
  let savedToast = null;

  // Reading the requests slice

  function slice() {
    if (!NC.store || typeof NC.store.get !== 'function') return null;
    const s = NC.store.get('requests');
    return s && Array.isArray(s.items) ? s : null;
  }

  // Rules can answer requests too, so make sure every decision has both lists before we read it
  function all() {
    const s = slice();
    if (!s) return [];
    s.items.forEach((r) => {
      if (!r.decision) return;
      if (!Array.isArray(r.decision.allowed)) r.decision.allowed = [];
      if (!Array.isArray(r.decision.declined)) r.decision.declined = (r.asks || []).map((a) => a.type).filter((t) => !r.decision.allowed.includes(t));
    });
    return s.items;
  }

  function get(id) {
    return all().find((r) => r.id === id) || null;
  }

  // Newest first, so the one that just showed up is always on top
  function pending() {
    return all().filter((r) => r.status === 'pending').sort((a, b) => (a.receivedDaysAgo || 0) - (b.receivedDaysAgo || 0));
  }

  function appOf(r) {
    return NC.app ? NC.app(r.appId) : { id: r.appId, name: r.appId, category: 'App', kind: 'app', color: '#57534A', icon: 'globe' };
  }

  function typeOf(key) {
    return NC.dataType ? NC.dataType(key) : { label: key, icon: 'info' };
  }

  function lower(key) {
    return typeOf(key).label.toLowerCase();
  }

  function isGame(app) {
    return app.rulesCategory === 'games' || app.category === 'Game';
  }

  function noun(r, app) {
    if (r.kind === 'cookies' || app.kind === 'site') return 'site';
    return isGame(app) ? 'game' : 'app';
  }

  function similarLabel(r, app) {
    const n = noun(r, app);
    if (n === 'game') return 'What similar games do';
    if (n === 'site') return app.category === 'News site' ? 'What other news sites do' : 'What similar sites do';
    return 'What similar apps do';
  }

  function when(days) {
    if (!days) return 'just now';
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  }

  function needed(r) {
    return r.asks.filter((a) => a.verdict === 'needed').map((a) => a.type);
  }

  function sameSet(a, b) {
    return a.length === b.length && a.every((x) => b.includes(x));
  }

  function askTitle(r, app) {
    const n = r.asks.length;
    if (r.kind === 'cookies') return app.name + ' wants to use ' + NC.dom.plural(n, 'kind') + ' of cookies';
    return app.name + ' is asking for ' + NC.dom.plural(n, 'thing');
  }

  function labels(types) {
    return types.map((t) => typeOf(t).label);
  }

  // "Shared email · said no to 3", used in the inbox
  function outcome(r) {
    const d = r.decision;
    if (!d) return '';
    const verb = r.kind === 'cookies' ? 'Allowed ' : 'Shared ';
    const got = d.allowed.length ? verb + NC.dom.listText(d.allowed.map(lower)) : verb + 'nothing';
    return d.declined.length ? got + ' · said no to ' + d.declined.length : got;
  }

  // The shared checks live in dom.js. The fallbacks are only for a dom.js that doesn't have them yet
  function reduced() {
    if (typeof NC.dom.reducedMotion === 'function') return NC.dom.reducedMotion();
    if (document.documentElement.classList.contains('reduce-motion')) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function frameScale() {
    if (typeof NC.dom.frameScale === 'function') return NC.dom.frameScale() || 1;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--frame-scale')) || 1;
  }

  function loggedIn() {
    try {
      return !!(NC.store && typeof NC.store.currentUser === 'function' && NC.store.currentUser());
    } catch (e) {
      return false;
    }
  }

  function toast(message, opts) {
    if (NC.ui && typeof NC.ui.toast === 'function') return NC.ui.toast(message, opts);
    return null;
  }

  function rulesReady() {
    return !!(NC.rules && typeof NC.rules.isConfigured === 'function');
  }

  // True on any step of this request's sheet (review, choose or done), but not on a request whose id just starts the same
  function onSheet(path, id) {
    const base = '/check/' + id;
    return path === base || path.indexOf(base + '/') === 0;
  }

  function closeSavedToast() {
    if (savedToast) savedToast.toast.close();
    savedToast = null;
  }

  // Undo also puts the receipt back through the store. Nicolas's undo does the same while the app is open,
  // this covers a reload

  function receiptSnap(appId) {
    if (!NC.store || !NC.store.has || !NC.store.has('receipts')) return null;
    const s = NC.store.get('receipts');
    if (!s || !Array.isArray(s.items)) return null;
    const i = s.items.findIndex((x) => x && (x.id === appId || x.appId === appId));
    return { had: i >= 0, index: i, value: i >= 0 ? s.items[i] : null };
  }

  function restoreReceipt(appId, snap) {
    if (!snap) return;
    NC.store.update('receipts', (s) => {
      if (!s || !Array.isArray(s.items)) return;
      const i = s.items.findIndex((x) => x && (x.id === appId || x.appId === appId));
      if (snap.had) {
        if (i >= 0) s.items[i] = snap.value;
        else s.items.splice(Math.max(0, snap.index), 0, snap.value);
      } else if (i >= 0) {
        s.items.splice(i, 1);
      }
    });
  }

  function hasReceipt(appId) {
    if (!NC.router.has('/receipts/' + appId)) return false;
    if (NC.receipts && typeof NC.receipts.get === 'function') {
      try {
        return !!NC.receipts.get(appId);
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  // Changing things

  function decide(id, allowed, mode) {
    const before = get(id);
    if (!before || !NC.store) return null;
    const types = before.asks.map((a) => a.type);
    const snap = {
      id: id,
      at: new Date().toISOString(),
      prev: { status: before.status, decision: before.decision || null, isNew: !!before.isNew, laterAt: before.laterAt || null },
      receipt: receiptSnap(before.appId),
    };
    NC.store.update('requests', (s) => {
      const r = s.items.find((x) => x.id === id);
      if (!r) return;
      r.status = 'decided';
      r.isNew = false;
      r.laterAt = null;
      r.decision = {
        at: snap.at,
        mode: mode,
        allowed: types.filter((t) => allowed.includes(t)),
        declined: types.filter((t) => !allowed.includes(t)),
      };
      s.lastUndo = snap;
    });
    const fresh = get(id);
    if (NC.receipts && typeof NC.receipts.recordDecision === 'function') {
      try {
        NC.receipts.recordDecision(fresh);
      } catch (e) {
        console.error('could not save the receipt:', e);
      }
    }
    const app = appOf(fresh);
    const t = toast('Choices saved for ' + app.name, {
      tone: 'success',
      action: { label: 'Undo', onClick: () => undo(id, snap, true) },
    });
    savedToast = t ? { id: id, toast: t } : null;
    return fresh;
  }

  // Undo puts their old choices back (and the receipt the way it was), nothing else changes
  function undo(id, snap, fromToast) {
    const s = slice();
    const u = snap || (s && s.lastUndo);
    if (!u || u.id !== id) return false;
    const r = get(id);
    if (!r) return false;
    NC.store.update('requests', (st) => {
      const x = st.items.find((i) => i.id === id);
      if (!x) return;
      x.status = u.prev.status;
      x.decision = u.prev.decision;
      x.isNew = u.prev.isNew;
      x.laterAt = u.prev.laterAt;
      if (st.lastUndo && st.lastUndo.id === id) st.lastUndo = null;
    });
    restoreReceipt(r.appId, u.receipt);
    if (fromToast) savedToast = null;
    else closeSavedToast();
    const app = appOf(r);
    const back = u.prev.status === 'pending';
    toast(back ? 'Undone. ' + app.name + ' hasn\'t gotten anything yet.' : 'Undone. Your earlier choices are back.', { tone: 'info', icon: 'undo' });
    // If they're still looking at this request, show the right step for it
    const cur = NC.router.current();
    if (cur && onSheet(cur.path, id)) {
      NC.router.go(back ? '/check/' + id : '/check/' + id + '/done', { replace: true, transition: 'none', force: true });
    }
    return true;
  }

  function canUndo(r) {
    const s = slice();
    const u = s && s.lastUndo;
    if (!u || u.id !== r.id || r.status !== 'decided') return false;
    return Date.now() - new Date(u.at).getTime() < UNDO_MINUTES * 60000;
  }

  function forgetUndo(id) {
    const s = slice();
    if (!s || !s.lastUndo || s.lastUndo.id !== id) return;
    NC.store.update('requests', (st) => {
      st.lastUndo = null;
    });
  }

  function later(r) {
    NC.store.update('requests', (s) => {
      const x = s.items.find((i) => i.id === r.id);
      if (!x) return;
      x.isNew = false;
      x.laterAt = new Date().toISOString();
    });
    toast('Saved for later. ' + appOf(r).name + ' gets nothing until you decide.', { tone: 'info', icon: 'clock' });
  }

  // The backdrops: a starry game splash, a news page, or a plain app splash

  function stars() {
    // Same stars every time, so the sky doesn't jump when the sheet changes
    let seed = 11;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const out = [];
    for (let i = 0; i < 34; i++) {
      const size = 1.5 + rnd() * 2;
      out.push(h('span.check-star', {
        class: i % 7 === 0 ? 'is-twinkle' : null,
        style: { left: (rnd() * 100).toFixed(1) + '%', top: (rnd() * 62).toFixed(1) + '%', width: size.toFixed(1) + 'px', height: size.toFixed(1) + 'px', opacity: (0.3 + rnd() * 0.6).toFixed(2) },
      }));
    }
    return out;
  }

  function sitePage(app) {
    const lines = [92, 100, 96, 88, 100, 71, 0, 98, 94, 100, 64];
    return h('div.site-page',
      h('div.site-bar', { style: { background: app.color } },
        h('span.site-logo', app.name),
        h('span.site-menu', h('i'), h('i'), h('i'))),
      h('div.site-article',
        h('p.site-kicker', 'Weather'),
        h('p.site-headline', 'Storm season is starting early this year'),
        h('p.site-byline', 'By the news desk · 4 min read'),
        h('div.site-photo'),
        h('div.site-lines', lines.map((w) => (w ? h('span', { style: { width: w + '%' } }) : h('span.site-gap'))))));
  }

  // The game sits under the same dim as the news page, like any app behind a sheet
  function backdrop(look, app) {
    if (look === 'site') return h('div.check-bg.check-bg--site', { 'aria-hidden': 'true' }, sitePage(app), h('div.check-dim'));
    if (look === 'game') return h('div.check-bg.check-bg--game', { 'aria-hidden': 'true' }, stars(), h('div.check-dim'));
    return h('div.check-bg.check-bg--app', { 'aria-hidden': 'true' });
  }

  // The name is see-through, so a star right behind it shows up as a dot on a letter. Hide just those
  function clearSky(el) {
    const words = Array.from(el.querySelectorAll('.check-splash-name, .check-splash-hint')).map((n) => n.getBoundingClientRect());
    if (!words.length || !words[0].width) return;
    el.querySelectorAll('.check-star').forEach((s) => {
      const b = s.getBoundingClientRect();
      const hit = words.some((w) => b.right > w.left - 4 && b.left < w.right + 4 && b.bottom > w.top - 4 && b.top < w.bottom + 4);
      s.classList.toggle('is-hidden', hit);
    });
  }

  function splash(look, app) {
    if (look === 'site') return null;
    return h('div.check-splash', { 'aria-hidden': 'true' },
      look === 'app' ? h('span.check-splash-tile', NC.icon(app.icon && NC.icon.has(app.icon) ? app.icon : 'globe', { size: 34 })) : null,
      h('p.check-splash-name', app.name),
      h('p.check-splash-hint', look === 'game' ? 'Tap anywhere to start' : 'Getting things ready'));
  }

  function lookFor(r, app) {
    if (r.kind === 'cookies' || app.kind === 'site') return 'site';
    return isGame(app) ? 'game' : 'app';
  }

  // The sheet slides between steps instead of the whole screen, like one iOS sheet changing its content
  function morph(el, sheet, step) {
    const old = document.querySelector('#view .check-sheet');
    const from = old && old.isConnected ? { top: old.offsetTop, step: Number(old.dataset.order) || 0, id: old.dataset.id } : null;
    requestAnimationFrame(() => {
      if (!sheet.isConnected) return;
      if (reduced()) return;
      if (!from || from.id !== sheet.dataset.id) {
        sheet.classList.add('is-rising');
        return;
      }
      const dy = from.top - sheet.offsetTop;
      if (Math.abs(dy) > 2) {
        sheet.style.transform = 'translateY(' + dy + 'px)';
        void sheet.offsetHeight;
        sheet.classList.add('is-morphing');
        sheet.style.transform = '';
        setTimeout(() => sheet.classList.remove('is-morphing'), 360);
      }
      sheet.classList.add(STEPS[step] >= from.step ? 'swap-fwd' : 'swap-back');
    });
  }

  // A drag on the grabber pulls the sheet down, far enough and it closes like a real sheet
  function enableDrag(handle, sheet, onClose) {
    let drag = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('button')) return;
      drag = { y0: e.clientY, dy: 0, k: frameScale(), t0: Date.now() };
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      drag.dy = Math.max(0, (e.clientY - drag.y0) / drag.k);
      sheet.style.transform = 'translateY(' + drag.dy + 'px)';
    });
    const end = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      sheet.classList.remove('is-dragging');
      const fast = d.dy > 40 && d.dy / Math.max(1, Date.now() - d.t0) > 0.6;
      if (d.dy > 110 || fast) onClose();
      else sheet.style.transform = '';
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function stage(r, step, parts) {
    const app = appOf(r);
    const look = lookFor(r, app);
    const grab = h('div.check-grab', { 'aria-hidden': 'true' }, h('span.check-grabber'));
    const scroll = h('div.check-scroll', parts.content);
    // The fade over the buttons is easy to miss, so a small "More below" shows while there's more to read.
    // Scrolling gets you there too, so it stays out of the way of screen readers and the tab order
    const more = h('button.check-more', {
      type: 'button',
      tabindex: '-1',
      'aria-hidden': 'true',
      onClick: () => scroll.scrollTo({ top: scroll.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }),
    }, 'More below', NC.icon('chevDown', { size: 16 }));
    const sheet = h('div.check-sheet', {
      class: 'check-sheet--' + step,
      'data-order': STEPS[step],
      'data-id': r.id,
      role: 'region',
      'aria-label': 'NeedCheck',
    }, grab, scroll, parts.footer ? h('div.check-foot', more, parts.footer) : null);
    // Tapping the app behind does nothing yet, the sheet just gives a little bounce
    const top = h('div.check-top', {
      onClick: () => {
        sheet.classList.remove('is-nudged');
        void sheet.offsetWidth;
        sheet.classList.add('is-nudged');
      },
    }, splash(look, app));
    const el = c.screen({ className: 'check', body: [top, sheet] });
    el.classList.add('check--' + look, 'check--' + step);
    el.insertBefore(backdrop(look, app), el.firstChild);
    el.style.setProperty('--app-color', app.color || 'var(--game)');
    el.dataset.statusBar = 'light';
    if (parts.onEscape) {
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.preventDefault();
        parts.onEscape();
      });
    }
    if (parts.onSwipe) enableDrag(grab, sheet, parts.onSwipe);
    // Finished animations have to let go of the transform, or dragging and closing can't move the sheet
    sheet.addEventListener('animationend', (e) => {
      if (e.target === sheet) sheet.classList.remove('is-rising', 'is-nudged');
    });
    morph(el, sheet, step);
    watchScroll(sheet, scroll);
    // The space above the sheet changes size between steps (and the name when the font loads), so check again then
    if (look === 'game' && window.ResizeObserver) {
      const ro = new ResizeObserver(() => clearSky(el));
      ro.observe(top);
      if (top.firstChild) ro.observe(top.firstChild);
    } else if (look === 'game') {
      requestAnimationFrame(() => clearSky(el));
    }
    return el;
  }

  // The divider and fade over the buttons tell people there's more below. Content can grow too
  // (like the amber warning on the choose step), so we watch what's inside, not just the box
  function watchScroll(sheet, scroll) {
    const check = () => {
      const more = scroll.scrollHeight > scroll.clientHeight + 1;
      sheet.classList.toggle('is-scrolly', more);
      sheet.classList.toggle('is-more', more && scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 4);
    };
    requestAnimationFrame(check);
    scroll.addEventListener('scroll', check, { passive: true });
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(check);
    ro.observe(scroll);
    Array.from(scroll.children).forEach((kid) => ro.observe(kid));
  }

  // Slides the sheet away first, then leaves, so closing feels like dismissing a sheet
  function slideAway(el, then) {
    const sheet = el && el.querySelector ? el.querySelector('.check-sheet') : null;
    if (!sheet || reduced()) {
      then();
      return;
    }
    sheet.style.transform = '';
    sheet.classList.add('is-leaving');
    setTimeout(then, 200);
  }

  // Review step

  function askRow(r, app, a) {
    const t = typeOf(a.type);
    return c.row({
      className: 'ask-row',
      left: c.iconTile(t.icon, { tone: TILE_TONE[a.verdict] || 'cream', size: 42 }),
      title: t.label,
      subtitle: a.reason,
      right: h('span.ask-right', c.verdict(a.verdict), h('span.ask-why', NC.icon('info', { size: 15 }), 'Why?')),
      ariaLabel: t.label + ', ' + (VERDICT_WORD[a.verdict] || a.verdict) + '. ' + a.reason + '. Show why',
      onClick: () => openWhy(r, a),
    });
  }

  // DP3 problem 10: cookie banners are where rules help most, so point people there
  function cookieTip(r) {
    if (r.kind !== 'cookies' || !rulesReady()) return null;
    let configured = true;
    try {
      configured = !!NC.rules.isConfigured();
    } catch (e) {
      return null;
    }
    if (configured) return null;
    const to = NC.router.has('/rules/setup') ? '/rules/setup' : '/rules';
    if (!NC.router.has(to)) return null;
    const open = () => NC.router.go(to);
    // Tapping anywhere on the tip works too, so the part that peeks out above the buttons on a small phone isn't a dead end.
    // The link sits at the end of the sentence, which keeps the tip short enough for the CNN sheet to fit
    return h('div.check-tip', { onClick: (e) => { if (!e.target.closest('.check-tip-link')) open(); } },
      c.iconTile('rules', { tone: 'white', size: 36, shape: 'square' }),
      h('p.check-tip-text', 'Tired of answering these? Set up rules once and NeedCheck answers cookie banners for you. ',
        h('button.link.check-tip-link', { type: 'button', onClick: open }, 'Set up rules', NC.icon('chev', { size: 14 }))));
  }

  function reviewScreen(r) {
    const app = appOf(r);
    let el = null;
    let gone = false;
    const leave = () => {
      if (gone) return;
      gone = true;
      later(r);
      slideAway(el, () => NC.router.back('/home'));
    };
    const head = h('div.check-head',
      c.iconTile('shield', { tone: 'brand', size: 38 }),
      h('div.check-head-text',
        h('p.check-brand', 'NeedCheck'),
        h('p.check-from', app.name + ' · ' + when(r.receivedDaysAgo))),
      c.iconButton('x', { label: 'Close. Decide later', className: 'check-close', onClick: leave }));
    // The rules tip goes right under the rows, so on small phones it peeks out above the buttons instead of hiding below them
    const content = [
      head,
      c.title(askTitle(r, app), { size: 'lg', as: 'h1', className: 'check-title' }),
      h('p.check-sub', 'Here\'s what the ' + noun(r, app) + ' actually needs to work.'),
      c.list(r.asks.map((a) => askRow(r, app, a)), { className: 'check-asks' }),
      cookieTip(r),
      r.note ? c.banner({ icon: 'check', tone: 'green', text: r.note, className: 'check-note' }) : null,
    ];
    const footer = [
      c.button('Allow only what\'s needed', {
        id: 'check-allow',
        onClick: () => {
          decide(r.id, needed(r), 'needed');
          NC.router.go('/check/' + r.id + '/done', { replace: true, transition: 'none' });
        },
      }),
      // Choose swaps into the same spot like Allow does, so closing the sheet later (even after an Undo) always lands where they opened it
      c.button('Choose for myself', { variant: 'secondary', onClick: () => NC.router.go('/check/' + r.id + '/choose', { replace: true, transition: 'none' }) }),
      c.button('Decide later', { variant: 'ghost', className: 'check-later', onClick: leave }),
    ];
    el = stage(r, 'review', { content: content, footer: footer, onEscape: leave, onSwipe: leave });
    return el;
  }

  // Why pop-up, every row opens its own now

  function whyTitle(app, a) {
    const phrase = WANT_PHRASE[a.type] || 'your ' + lower(a.type);
    return 'Why does ' + app.name + ' want ' + phrase + '?';
  }

  function openWhy(r, a) {
    if (!NC.ui || typeof NC.ui.sheet !== 'function') return;
    const app = appOf(r);
    const t = typeOf(a.type);
    const w = a.why || {};
    let sheet = null;
    const part = (label, text) => (text ? h('div.why-part', h('h3.why-label', label), h('p.why-text', text)) : null);
    const rate = NC.help && typeof NC.help.showRatings === 'function'
      ? h('button.link.why-rate', { type: 'button', onClick: () => NC.help.showRatings() }, NC.icon('info', { size: 16 }), 'How we rate')
      : null;
    // The dots take the verdict's colors, so a small key says which ones mean "asks"
    const sim = w.similar
      ? h('div.why-part',
        h('h3.why-label', similarLabel(r, app)),
        c.dots(w.similar.yes, w.similar.total, { label: w.similar.text }),
        h('p.why-dots-key', { 'aria-hidden': 'true' },
          h('span.why-key', h('span.dot.dot--yes'), 'Asks'),
          h('span.why-key', h('span.dot.dot--no'), 'Doesn\'t ask')))
      : null;
    sheet = NC.ui.sheet({
      className: 'why-sheet',
      body: [
        h('div.why-nav',
          c.iconButton('back', { label: 'Back to the list', onClick: () => sheet.close('button') }),
          h('p.why-nav-title', t.label),
          h('span.why-nav-gap')),
        h('div.why-top', c.iconTile(t.icon, { tone: TILE_TONE[a.verdict] || 'cream', size: 60 }), c.verdict(a.verdict)),
        h('h2.title-lg.why-title', whyTitle(app, a)),
        part('What they want', w.want),
        part('Why they need it', w.because),
        part('If you said no', w.ifNo),
        sim,
        rate,
      ],
      footer: [c.button('Got it', { variant: 'dark', onClick: () => sheet.close('button') })],
    });
    sheet.el.classList.add('why-sheet--' + a.verdict);
  }

  // Choose step: toggles start at our pick, and a needed one warns before you block it

  function chooseScreen(r) {
    const app = appOf(r);
    const start = r.decision ? r.decision.allowed : needed(r);
    const on = {};
    r.asks.forEach((a) => {
      on[a.type] = start.includes(a.type);
    });
    const items = r.asks.map((a) => {
      const t = typeOf(a.type);
      const nameId = NC.dom.uid('choose-name');
      const slot = h('div.choose-warn-slot', { 'aria-live': 'polite' });
      // reveal is only for a switch they just flipped. Email is the last row, so on a short phone the
      // warning would land under the buttons where nobody reads it
      const showWarn = (isOn, reveal) => {
        NC.dom.clear(slot);
        if (a.verdict !== 'needed' || isOn) return;
        const banner = c.banner({ icon: 'alert', tone: 'amber', text: a.warn || app.name + ' needs this to work properly.', className: 'choose-warn' });
        slot.appendChild(banner);
        if (reveal && banner.scrollIntoView) banner.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      };
      const tog = c.toggle({
        checked: on[a.type],
        labelledBy: nameId,
        onChange: (v) => {
          on[a.type] = v;
          showWarn(v, true);
        },
      });
      showWarn(on[a.type]);
      return h('div.choose-item',
        h('div.choose-row',
          h('button.choose-info', { type: 'button', 'aria-label': t.label + ', ' + VERDICT_WORD[a.verdict] + '. Show why', onClick: () => openWhy(r, a) },
            c.iconTile(t.icon, { tone: TILE_TONE[a.verdict] || 'cream', size: 42 }),
            h('span.choose-text',
              h('span.choose-name', { id: nameId }, t.label, NC.icon('info', { size: 15, className: 'choose-i' })),
              c.verdict(a.verdict))),
          tog),
        slot);
    });
    const n = noun(r, app);
    // Still waiting means they came from the review, so swap it back in. Otherwise they came from the done screen or a receipt
    const goBack = () => {
      const now = get(r.id);
      if (now && now.status === 'pending') NC.router.go('/check/' + r.id, { replace: true, transition: 'none' });
      else NC.router.back('/check/' + r.id);
    };
    const content = [
      h('div.check-nav',
        c.iconButton('back', { label: 'Back', onClick: goBack }),
        h('p.check-nav-title', 'Choose for yourself'),
        h('span.check-nav-gap')),
      c.title('What should ' + app.name + ' get?', { size: 'lg', as: 'h1', className: 'choose-title' }),
      h('div.list.choose-list', items),
      h('p.choose-note', 'Needed items keep the ' + n + ' working. Optional ones are up to you.'),
    ];
    const footer = [
      c.button('Save my choices', {
        id: 'choose-save',
        onClick: () => {
          const allowed = r.asks.map((a) => a.type).filter((t) => on[t]);
          decide(r.id, allowed, sameSet(allowed, needed(r)) ? 'needed' : 'custom');
          NC.router.go('/check/' + r.id + '/done', { replace: true, transition: 'none' });
        },
      }),
    ];
    return stage(r, 'choose', { content: content, footer: footer, onEscape: goBack });
  }

  // Done step

  // Looking back at an older answer just says what happened, the "Done." is for right after deciding
  function doneTitle(r, app, fresh) {
    const d = r.decision;
    if (d.mode === 'rules') return 'Your rules answered ' + app.name + ' for you.';
    if (d.mode === 'custom') return (fresh ? 'Saved. ' : '') + app.name + ' gets what you picked.';
    return (fresh ? 'Done. ' : '') + app.name + ' got only what it needs.';
  }

  function ruleBox(r, app) {
    if (!isGame(app) || !NC.rules || typeof NC.rules.addCustom !== 'function') return null;
    let has = false;
    try {
      has = typeof NC.rules.hasCustom === 'function' && NC.rules.hasCustom(GAMES_RULE.id);
    } catch (e) {
      has = false;
    }
    // The rule is already on (it answered any games that were waiting when they added it), so just say so
    if (has) {
      return h('p.done-has-rule', NC.icon('check', { size: 18 }), 'Your games rule is on. You can change it any time in Rules.');
    }
    const id = NC.dom.uid('done-rule');
    const box = c.checkbox({ id: id, labelledBy: id + '-title', describedBy: id + '-sub' });
    const wrap = h('div.done-rule',
      box,
      h('label.done-rule-text', { for: id },
        h('span.done-rule-title', { id: id + '-title' }, 'Always do this for games'),
        h('span.done-rule-sub', { id: id + '-sub' }, 'Games get only what they need to run. No location or contacts. You can change this in Rules.')));
    wrap.isOn = () => box.isOn();
    return wrap;
  }

  // "Answered Candy Crush: said no to contacts and photos", one line per game in the rules log
  function gameLogText(r, app) {
    const d = r.decision;
    const parts = [];
    if (d.allowed.length) parts.push('shared ' + NC.dom.listText(d.allowed.map(lower)));
    if (d.declined.length) parts.push('said no to ' + NC.dom.listText(d.declined.map(lower)));
    return 'Answered ' + app.name + (parts.length ? ': ' + parts.join(', ') : '');
  }

  // The new rule answers games that are still waiting too, the same way the cookie rules answer banners
  function answerWaitingGames() {
    const ids = pending().filter((r) => isGame(appOf(r))).map((r) => r.id);
    if (!ids.length) return [];
    const at = new Date().toISOString();
    NC.store.update('requests', (s) => {
      s.items.forEach((x) => {
        if (!ids.includes(x.id) || x.status !== 'pending') return;
        const ok = needed(x);
        const types = x.asks.map((a) => a.type);
        x.status = 'auto';
        x.isNew = false;
        x.laterAt = null;
        x.decision = { at: at, mode: 'rules', allowed: types.filter((t) => ok.includes(t)), declined: types.filter((t) => !ok.includes(t)) };
      });
    });
    const done = ids.map(get).filter((r) => r && r.status === 'auto');
    done.forEach((r) => {
      if (NC.receipts && typeof NC.receipts.recordDecision === 'function') {
        try {
          NC.receipts.recordDecision(r);
        } catch (e) {
          console.error('could not save the receipt:', e);
        }
      }
      if (typeof NC.rules.log === 'function') {
        try {
          NC.rules.log(gameLogText(r, appOf(r)), 'games');
        } catch (e) {
          console.error('could not add to the rules log:', e);
        }
      }
    });
    return done;
  }

  function commitRule(rule) {
    if (!rule || typeof rule.isOn !== 'function' || !rule.isOn()) return false;
    if (!NC.rules || typeof NC.rules.addCustom !== 'function') return false;
    try {
      if (typeof NC.rules.hasCustom === 'function' && NC.rules.hasCustom(GAMES_RULE.id)) return false;
      NC.rules.addCustom(Object.assign({}, GAMES_RULE));
    } catch (e) {
      console.error('could not add the games rule:', e);
      return false;
    }
    const names = answerWaitingGames().map((r) => appOf(r).name);
    const see = NC.router.has('/rules') ? { label: 'See rule', onClick: () => NC.router.go('/rules?added=' + GAMES_RULE.id) } : null;
    const msg = names.length ? 'Rule added. It also answered ' + names.join(' and ') + '.' : 'Rule added. New games will get only what they need.';
    toast(msg, { tone: 'success', action: see || undefined });
    return true;
  }

  function doneScreen(r) {
    const app = appOf(r);
    const d = r.decision;
    const undoable = canUndo(r);
    const fresh = undoable || Date.now() - new Date(d.at).getTime() < 60000;
    // The box spells out "only what they need", so it only shows when that's what they just picked
    const rule = d.mode === 'needed' ? ruleBox(r, app) : null;
    const verb = r.kind === 'cookies' ? 'Allowed' : 'Shared';
    const notVerb = r.kind === 'cookies' ? 'Said no' : 'Not shared';
    const leaving = () => {
      forgetUndo(r.id);
      commitRule(rule);
    };
    // A ticked box counts however they leave, phone back included. Undo puts the request back to
    // waiting before it moves on, so the rule never sneaks in after an Undo
    if (rule && typeof rule.isOn === 'function' && typeof NC.router.onChange === 'function') {
      const stop = NC.router.onChange((cur) => {
        if (cur && cur.path === '/check/' + r.id + '/done') return;
        stop();
        const now = get(r.id);
        if (loggedIn() && now && now.status !== 'pending') commitRule(rule);
      });
    }
    let receipt = null;
    if (hasReceipt(r.appId)) {
      receipt = h('p.done-receipt',
        NC.icon('receipt', { size: 20, className: 'done-receipt-icon' }),
        h('span', 'Receipt saved ·'),
        h('button.link.done-receipt-link', {
          type: 'button',
          onClick: () => {
            leaving();
            NC.router.go('/receipts/' + r.appId);
          },
        }, 'View receipt'));
    }
    const decidedOn = d.mode === 'rules'
      ? 'Answered by your rules · ' + NC.dom.fmtDate(d.at, 'day')
      : 'You decided · ' + NC.dom.fmtDate(d.at, 'day');
    const content = [
      h('div.done-mark', { 'aria-hidden': 'true' }, NC.icon('check', { size: 34, stroke: 3 })),
      c.title(doneTitle(r, app, fresh), { size: 'lg', as: 'h1', className: 'done-title' }),
      fresh ? null : h('p.done-when', decidedOn),
      h('div.done-card',
        h('div.done-line',
          h('span.done-key.done-key--yes', NC.icon('check', { size: 18, stroke: 2.6 }), verb),
          h('span.done-val', d.allowed.length ? labels(d.allowed).join(', ') : 'Nothing')),
        h('div.done-line',
          h('span.done-key.done-key--no', NC.icon('x', { size: 18, stroke: 2.4 }), notVerb),
          h('span.done-val', d.declined.length ? labels(d.declined).join(', ') : 'Nothing'))),
      rule,
      receipt,
      cookieTip(r),
    ];
    const goHome = () => {
      leaving();
      NC.router.go('/home', { transition: 'fade' });
    };
    const footer = [
      c.button('Back to home', { id: 'done-home', onClick: goHome }),
      undoable
        ? c.button('Undo', { variant: 'ghost', icon: 'undo', className: 'done-undo', onClick: () => undo(r.id) })
        : c.button('Change what ' + app.name + ' gets', { variant: 'ghost', className: 'done-undo', onClick: () => NC.router.go('/check/' + r.id + '/choose', { transition: 'none' }) }),
    ];
    return stage(r, 'done', { content: content, footer: footer, onEscape: goHome });
  }

  // Routes

  function bounce() {
    NC.router.go(NC.router.has('/requests') ? '/requests' : '/home', { replace: true });
    return null;
  }

  function nameFor(id) {
    const r = get(id);
    return r ? appOf(r).name : 'Request';
  }

  NC.router.add('/check/:id', {
    tab: null,
    title: (p) => nameFor(p.id),
    render(p) {
      const r = get(p.id);
      if (!r) return bounce();
      if (r.status !== 'pending') {
        NC.router.go('/check/' + r.id + '/done', { replace: true, transition: 'none' });
        return null;
      }
      return reviewScreen(r);
    },
  });

  NC.router.add('/check/:id/choose', {
    tab: null,
    title: (p) => 'Choose for ' + nameFor(p.id),
    render(p) {
      const r = get(p.id);
      return r ? chooseScreen(r) : bounce();
    },
  });

  NC.router.add('/check/:id/done', {
    tab: null,
    title: (p) => 'Done with ' + nameFor(p.id),
    render(p) {
      const r = get(p.id);
      if (!r) return bounce();
      if (r.status === 'pending' || !r.decision) {
        NC.router.go('/check/' + r.id, { replace: true, transition: 'none' });
        return null;
      }
      return doneScreen(r);
    },
  });

  // The inbox: everything waiting, then what they already answered

  function openDecided(r) {
    if (hasReceipt(r.appId)) NC.router.go('/receipts/' + r.appId);
    else NC.router.go('/check/' + r.id + '/done');
  }

  function waitingRow(r) {
    const app = appOf(r);
    const fresh = r.isNew && !r.laterAt;
    // "2 days ago" stays in one piece and the dot stays with the words before it, so no line starts
    // with a lone "ago" or a stray dot
    const sub = r.laterAt ? 'Saved for later · nothing shared' : [r.context ? r.context + '\u00a0· ' : '', h('span.check-nowrap', when(r.receivedDaysAgo))];
    return c.row({
      left: c.appTile(app, { size: 44 }),
      title: askTitle(r, app),
      subtitle: sub,
      right: fresh ? c.chip('New', { tone: 'new' }) : null,
      chevron: true,
      onClick: () => NC.router.go('/check/' + r.id, { transition: 'fade' }),
    });
  }

  function decidedRow(r) {
    const app = appOf(r);
    const by = r.status === 'auto' || (r.decision && r.decision.mode === 'rules') ? 'Your rules answered' : 'You decided';
    return c.row({
      left: c.appTile(app, { size: 44 }),
      title: app.name,
      subtitle: by + ' · ' + NC.dom.fmtDate(r.decision.at, 'day'),
      meta: outcome(r),
      chevron: true,
      ariaLabel: app.name + '. ' + by + ' ' + NC.dom.fmtDate(r.decision.at, 'day') + '. ' + outcome(r),
      onClick: () => openDecided(r),
    });
  }

  NC.router.add('/requests', {
    tab: 'home',
    title: 'Requests',
    live: true,
    render() {
      const waiting = pending();
      const done = all().filter((r) => r.status !== 'pending' && r.decision)
        .sort((a, b) => new Date(b.decision.at) - new Date(a.decision.at));
      return c.screen({
        className: 'requests',
        nav: c.navBar({ title: 'Requests', back: '/home' }),
        body: [
          h('p.lead.requests-lead', 'Every app and site that asked for your info. Tap one to see what it wants.'),
          c.section(waiting.length ? 'Waiting for you · ' + waiting.length : 'Waiting for you',
            waiting.length
              ? c.card(c.list(waiting.map(waitingRow)), { className: 'requests-card' })
              : c.card(c.empty({ icon: 'checkCircle', tone: 'green', title: 'You\'re all caught up', text: 'Nothing is waiting for an answer right now.' }), { className: 'requests-card', pad: false })),
          done.length ? c.section('Recently decided', c.card(c.list(done.map(decidedRow)), { className: 'requests-card' })) : null,
        ],
      });
    },
  });

  // Hooks into Home and the tab bar

  function homeCard(r) {
    const app = appOf(r);
    const fresh = r.isNew && !r.laterAt;
    let sub = 'Check before you allow';
    if (r.laterAt) sub = 'Saved for later · nothing shared';
    else if (!fresh) sub = (r.kind === 'cookies' ? 'Cookie banner · ' : 'Asked ') + when(r.receivedDaysAgo);
    const card = c.card(c.row({
      left: c.appTile(app, { size: 52 }),
      title: askTitle(r, app),
      subtitle: sub,
      right: fresh ? c.chip('New', { tone: 'new' }) : null,
      chevron: !fresh,
      ariaLabel: askTitle(r, app) + '. ' + sub + (fresh ? '. New' : ''),
      onClick: () => NC.router.go('/check/' + r.id, { transition: 'fade' }),
    }), { className: 'req-card' });
    card.classList.add('card--raised');
    return card;
  }

  // Anything that came in today sits at the very top, older ones go under the rules and receipts cards
  NC.hooks.add('home-cards', () => pending().map((r, i) => ({
    id: 'request-' + r.id,
    priority: (r.receivedDaysAgo ? 30 : 10) + i,
    el: homeCard(r),
  })));

  // Only this week's answers count, so the older inbox history doesn't inflate the numbers.
  // Both numbers count asks (Temple Run's 4 things are 4 asks checked), so "kept" can never pass "checked"
  NC.hooks.add('home-stats', () => {
    const weekAgo = Date.now() - 7 * 86400000;
    const week = all().filter((r) => r.status === 'decided' && r.decision && new Date(r.decision.at).getTime() >= weekAgo);
    return {
      checked: week.reduce((n, r) => n + r.asks.length, 0),
      declined: week.reduce((n, r) => n + r.decision.declined.length, 0),
      waiting: pending().length,
    };
  });

  NC.hooks.add('tab-badge', (tab) => (tab === 'home' ? pending().length || null : null));

  NC.hooks.add('data-reset', closeSavedToast);

  // The Undo toast only makes sense on that request's sheet or back on Home. Anywhere else (like another
  // request's review) tapping it would quietly undo something they aren't looking at
  if (typeof NC.router.onChange === 'function') {
    NC.router.onChange((cur) => {
      if (!savedToast || !cur) return;
      if (cur.path === '/home' || onSheet(cur.path, savedToast.id)) return;
      closeSavedToast();
    });
  }

  // Small API so other screens can link to a request or show its outcome
  NC.requests = {
    all: all,
    get: get,
    pending: pending,
    outcome: outcome,
    decide: decide,
    undo: (id) => undo(id),
    open: (id) => NC.router.go('/check/' + id, { transition: 'fade' }),
    openWhy: (id, type) => {
      const r = get(id);
      const a = r && r.asks.find((x) => x.type === type);
      if (a) openWhy(r, a);
    },
  };
})();
