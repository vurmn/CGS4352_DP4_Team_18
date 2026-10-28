// Hash router (#/receipts/walmart) plus the tab bar and screen transitions.
// Tabs register themselves, so a teammate's missing file just means a missing tab.
// Routes with live: true redraw on store changes. It's off by default so half-typed input is never rebuilt.
// A render() can redirect with go(path, { replace: true }) and return null.
(function () {
  const NC = (window.NC = window.NC || {});

  const routes = [];
  const tabs = [];
  const listeners = [];
  const scrollMemory = {};
  // Which screen sits at each history step, so popTo() and backTo() can reuse one we already have
  const visited = {};
  const DUR = { push: 280, back: 280, fade: 180, up: 320, down: 280 };
  // What each transition does to the new screen, the old screen, and which one sits on top
  const PLAN = {
    push: { inn: 'push-in', out: 'push-out', top: 'new' },
    back: { inn: 'back-in', out: 'back-out', top: 'old' },
    fade: { inn: 'fade-in', out: 'stay', top: 'new' },
    up: { inn: 'up-in', out: 'stay', top: 'new' },
    down: { inn: 'stay', out: 'down-out', top: 'old' },
  };
  const ANIM_CLASSES = ['push-in', 'push-out', 'back-in', 'back-out', 'fade-in', 'stay', 'up-in', 'down-out'].map((n) => 'anim-' + n);
  const PLACEHOLDER = { auth: false, tab: null, title: null, render: placeholderHome };

  let view = null;
  let tabbar = null;
  let cur = null;
  let started = false;
  let idx = 0;
  let enteredWith = 'none';
  let anim = null;
  let navCount = 0;
  let rendering = 0;
  let showing = null;
  let storeQueued = false;
  let storeDirty = false;
  let tabSig = '';
  let silentHash = null;
  let historyOk = true;
  let backAt = 0;
  let backVia = null;
  let quietUntil = 0;

  function normalize(p) {
    let s = String(p == null ? '' : p).trim().replace(/^#/, '');
    if (!s.startsWith('/')) s = '/' + s;
    s = s.replace(/\/{2,}/g, '/');
    if (s.length > 1) s = s.replace(/\/+$/, '');
    return s;
  }

  function split(full) {
    const raw = String(full == null ? '' : full).replace(/^#/, '');
    const q = raw.indexOf('?');
    const path = normalize(q === -1 ? raw : raw.slice(0, q));
    const qs = q === -1 ? '' : raw.slice(q + 1);
    const query = {};
    if (qs) new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
    return { path, qs, query, full: path + (qs ? '?' + qs : '') };
  }

  function compile(pattern) {
    const keys = [];
    let statics = 0;
    const src = normalize(pattern).split('/').map((seg) => {
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '([^/]+)';
      }
      if (seg) statics += 1;
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    return { keys, statics, re: new RegExp('^' + src + '$') };
  }

  // When two patterns match, the one with more fixed words wins (/receipts/search over /receipts/:id)
  function match(path) {
    let best = null;
    routes.forEach((r) => {
      const m = r.re.exec(path);
      if (!m) return;
      if (best && best.route.statics >= r.statics) return;
      const params = {};
      r.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]);
        } catch (e) {
          params[k] = m[i + 1];
        }
      });
      best = { route: r, params };
    });
    return best;
  }

  function add(pattern, def) {
    const c = compile(pattern);
    const entry = Object.assign({ pattern: normalize(pattern), def: def || {} }, c);
    const at = routes.findIndex((r) => r.pattern === entry.pattern);
    if (at >= 0) routes[at] = entry;
    else routes.push(entry);
    if (started) renderTabs();
  }

  function addTab(tab) {
    if (!tab || !tab.id) return;
    const t = Object.assign({ order: 99, icon: 'home', label: tab.id }, tab, { path: normalize(tab.path || '/' + tab.id) });
    const at = tabs.findIndex((x) => x.id === t.id);
    if (at >= 0) tabs[at] = t;
    else tabs.push(t);
    tabs.sort((a, b) => a.order - b.order);
    if (started) renderTabs();
  }

  function has(path) {
    return !!match(split(path).path);
  }

  function visibleTabs() {
    return tabs.filter((t) => !!match(t.path));
  }

  function fallbackPath() {
    if (has('/home')) return '/home';
    const first = visibleTabs()[0];
    return first ? first.path : null;
  }

  function loginPath() {
    return has('/welcome') ? '/welcome' : has('/login') ? '/login' : null;
  }

  function currentUser() {
    try {
      return NC.store && typeof NC.store.currentUser === 'function' ? NC.store.currentUser() : undefined;
    } catch (e) {
      console.error('could not read the current user:', e);
      return null;
    }
  }

  // Works out which screen a path really shows: login gate, guest-only screens, unknown paths
  function resolve(full, depth) {
    const d = depth || 0;
    const s = split(full);
    const m = s.path === '/' ? null : match(s.path);
    const redirect = (to) => Object.assign(resolve(to, d + 1), { redirected: true });

    if (!m) {
      const fb = fallbackPath();
      if (fb && fb !== s.path && d < 4) return redirect(fb);
      // No home screen yet (before the Home part is in), but logged out people still start at welcome
      const gate = currentUser() === null ? loginPath() : null;
      if (gate && d < 4) return redirect(gate);
      const p = s.path === '/' ? '/home' : s.path;
      return { full: p, path: p, params: {}, query: s.query, def: PLACEHOLDER };
    }
    const def = m.route.def;
    const user = currentUser();
    if (user !== undefined && d < 4) {
      if (def.auth !== false && !user) {
        const to = loginPath();
        if (to && to !== s.path) return redirect(to);
      }
      if (def.guestOnly && user) {
        const to = fallbackPath() || '/home';
        if (to !== s.path) return redirect(to);
      }
    }
    return { full: s.full, path: s.path, params: m.params, query: s.query, def };
  }

  function hashFull() {
    return split(location.hash || '').full;
  }

  // The way back out of a screen mirrors the way we came in
  function inverse(t) {
    return { push: 'back', up: 'down', fade: 'fade' }[t] || 'none';
  }

  function enterKind(t) {
    return { back: 'push', down: 'up' }[t] || t;
  }

  function writeHistory(full, replace, state) {
    if (historyOk) {
      try {
        if (replace) history.replaceState(state, '', '#' + full);
        else history.pushState(state, '', '#' + full);
        return;
      } catch (e) {
        historyOk = false;
      }
    }
    // Very old or locked down browsers: plain hash changes, no direction info
    silentHash = '#' + full;
    if (replace) location.replace('#' + full);
    else location.hash = full;
  }

  function go(target, opts) {
    const o = opts || {};
    if (!started) {
      writeHistory(split(target).full, true, { ncIdx: 0, ncT: 'none' });
      return;
    }
    const r = resolve(target);
    // While show() draws a new screen, cur is still the old one, so compare with the new one
    const here = showing || cur;
    if (here && r.full === here.full && !o.force) {
      // A render() sending you to the screen it's drawing has nothing left to do
      if (!rendering) refresh();
      return;
    }
    if (showing && cur && r.full === cur.full && !o.force) {
      stay();
      return;
    }
    let t = o.transition;
    if (!t) {
      if (r.redirected) t = 'fade';
      else if (r.def.tab && (!cur || r.def.tab !== cur.def.tab)) t = 'fade';
      else t = 'push';
    }
    if (o.replace) {
      delete scrollMemory[idx];
    } else {
      rememberScroll();
      idx += 1;
      forgetFrom(idx);
    }
    enteredWith = enterKind(t);
    writeHistory(r.full, !!o.replace, { ncIdx: idx, ncT: enteredWith });
    show(r, t);
  }

  // A render() bounced right back to the screen that's up (a typed link to a missing receipt, a
  // step you can't be on yet). Keep that screen as it is and just fix the address bar
  function stay() {
    navCount += 1;
    writeHistory(cur.full, true, { ncIdx: idx, ncT: enteredWith });
  }

  function back(fallbackPathArg) {
    if (idx > 0 && historyOk) {
      // The popstate comes a moment later, so a fast double tap would otherwise go back twice
      if (Date.now() - backAt < 700) return;
      backAt = Date.now();
      backVia = { to: fallbackPathArg };
      history.back();
      return;
    }
    go(fallbackPathArg || fallbackPath() || '/home', { replace: true, transition: 'back' });
  }

  // A back button landed on a second copy of the screen we're on (an undo or a bounce leaves
  // those), which would look like a dead tap, so keep going
  function skipCopy() {
    if (idx > 0) {
      backAt = Date.now();
      history.back();
      return;
    }
    const via = backVia;
    backVia = null;
    backAt = 0;
    if (via) go(via.to || fallbackPath() || '/home', { replace: true, transition: 'back' });
  }

  // A path with a query has to match exactly, a bare path matches that screen with any query
  function sameScreen(entry, want) {
    return !!entry && (want.qs ? entry.full === want.full : entry.path === want.path);
  }

  // Pop back to a screen that's already in history instead of piling up a new copy of it.
  // A deep link or a reload forgets the trail, and then it's a plain go()
  function popTo(target, transition) {
    const want = split(target);
    if (historyOk && started) {
      for (let k = idx - 1; k >= 0 && visited[k]; k--) {
        if (!sameScreen(visited[k], want)) continue;
        // Same double tap worry as back()
        if (Date.now() - backAt < 700) return;
        backAt = Date.now();
        history.go(k - idx);
        return;
      }
    }
    go(want.full, { transition: transition || 'back' });
  }

  // One step back when that's the screen we want, otherwise swap this one for it
  function backTo(target) {
    const want = split(target);
    if (historyOk && idx > 0 && sameScreen(visited[idx - 1], want)) back(want.full);
    else go(want.full, { replace: true, transition: 'back' });
  }

  // Browser back / forward, or someone typing a hash by hand
  function onPop() {
    if (silentHash && location.hash === silentHash) {
      silentHash = null;
      return;
    }
    const full = hashFull();
    const st = history.state;
    const hasIdx = !!st && typeof st.ncIdx === 'number';
    if (cur && full === cur.full) {
      // Same screen (a redirect can leave two entries with one path), just keep our position right
      if (!hasIdx || st.ncIdx === idx) return;
      const backwards = st.ncIdx < idx;
      idx = st.ncIdx;
      enteredWith = st.ncT || enteredWith;
      visited[idx] = { path: cur.path, full: cur.full };
      // Only for our own back buttons: a screen may move history onto a copy of itself on purpose
      if (backwards && backVia) {
        skipCopy();
      } else {
        backAt = 0;
        backVia = null;
      }
      return;
    }
    backAt = 0;
    backVia = null;
    let t;
    if (hasIdx) {
      if (st.ncIdx < idx) t = inverse(enteredWith);
      else if (st.ncIdx > idx) t = st.ncT || 'push';
      else t = 'none';
      rememberScroll();
      idx = st.ncIdx;
      enteredWith = st.ncT || 'push';
    } else {
      rememberScroll();
      idx += 1;
      forgetFrom(idx);
      t = 'push';
      enteredWith = t;
    }
    const r = resolve(full);
    if (r.redirected) t = 'fade';
    if (r.full !== full || !hasIdx) writeHistory(r.full, true, { ncIdx: idx, ncT: enteredWith });
    show(r, t);
  }

  // Back to a list should land where you left it, so each history entry keeps its scroll
  function rememberScroll() {
    if (cur && cur.el) scrollMemory[idx] = saveScroll(cur.el);
  }

  function forgetFrom(n) {
    [scrollMemory, visited].forEach((map) => {
      Object.keys(map).forEach((k) => {
        if (Number(k) >= n) delete map[k];
      });
    });
  }

  function saveScroll(el) {
    return Array.from(el.querySelectorAll('.screen-body, .fchips, [data-keep-scroll]')).map((n) => [n.scrollTop, n.scrollLeft]);
  }

  function restoreScroll(el, saved) {
    if (!saved) return;
    el.querySelectorAll('.screen-body, .fchips, [data-keep-scroll]').forEach((n, i) => {
      if (!saved[i]) return;
      n.scrollTop = saved[i][0];
      n.scrollLeft = saved[i][1];
    });
  }

  function renderDef(r) {
    let el = null;
    rendering += 1;
    try {
      el = r.def.render ? r.def.render(r.params, r.query) : null;
    } catch (e) {
      console.error('screen for ' + r.path + ' failed to render:', e);
      el = errorScreen();
    } finally {
      rendering -= 1;
    }
    if (!(el instanceof Element)) el = placeholderScreen();
    el.classList.add('screen');
    el.classList.toggle('with-tabs', tabsShown(r.def));
    return el;
  }

  // A bar with a single tab just looks unfinished, so it only shows from two tabs up
  function tabsShown(def) {
    return !!(def && def.tab) && visibleTabs().length > 1;
  }

  function show(r, t) {
    finishAnim();
    navCount += 1;
    const nav = navCount;
    const prev = cur;
    const was = showing;
    showing = r;
    let el = null;
    try {
      el = renderDef(r);
    } finally {
      showing = was;
    }
    // The render() sent us somewhere else (say an id that doesn't exist), and that screen is already up
    if (nav !== navCount) return;
    const wasTabs = !!prev && tabsShown(prev.def);
    const nowTabs = tabsShown(r.def);
    cur = Object.assign({}, r, { el });
    visited[idx] = { path: r.path, full: r.full };

    const tt = typeof r.def.title === 'function' ? r.def.title(r.params, r.query) : r.def.title;
    document.title = tt ? tt + ' · NeedCheck' : 'NeedCheck';
    renderTabs();

    const motion = prev && prev.el && prev.el.isConnected && t !== 'none' && PLAN[t] && !NC.dom.reducedMotion();
    if (!motion) {
      NC.dom.clear(view).appendChild(el);
      tabbar.hidden = !nowTabs;
    } else {
      view.appendChild(el);
      animate(prev.el, el, t, wasTabs, nowTabs);
    }
    if (scrollMemory[idx]) restoreScroll(el, scrollMemory[idx]);
    afterShow(el);
    quietUntil = Date.now() + 400;
    listeners.slice().forEach((fn) => {
      try {
        fn(current());
      } catch (e) {
        console.error('router listener failed:', e);
      }
    });
    // A sheet that just closed because of this navigation can leave focus nowhere, so try again
    const a = document.activeElement;
    if (cur.el === el && (!a || a === document.body || !a.isConnected || a.closest('[inert]'))) focusScreen(el);
  }

  function afterShow(el) {
    const app = NC.dom.appRoot();
    const light = el.classList.contains('screen--dark') || el.dataset.statusBar === 'light';
    if (light) app.setAttribute('data-status', 'light');
    else app.removeAttribute('data-status');
    // Phone browsers tint their toolbar with theme-color, so match the screen
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') meta.setAttribute('content', bg);
    }
    focusScreen(el);
  }

  function focusScreen(el) {
    const target = el.querySelector('h1') || el.querySelector('.nav-title:not(:empty), h2') || el;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try {
      target.focus({ preventScroll: true });
    } catch (e) {
      target.focus();
    }
  }

  function animate(oldEl, newEl, t, wasTabs, nowTabs) {
    const plan = PLAN[t];
    const topEl = plan.top === 'new' ? newEl : oldEl;
    const bottomEl = topEl === newEl ? oldEl : newEl;
    let owner = null;
    if (wasTabs && !nowTabs) owner = oldEl;
    if (!wasTabs && nowTabs) owner = newEl;

    oldEl.setAttribute('aria-hidden', 'true');
    oldEl.inert = true;
    topEl.style.zIndex = owner === topEl ? 3 : owner ? 5 : 3;
    bottomEl.style.zIndex = owner === bottomEl ? 2 : 1;
    [oldEl, newEl].forEach((e) => e.classList.add('is-anim'));
    newEl.classList.add('anim-' + plan.inn);
    oldEl.classList.add('anim-' + plan.out);

    // The tab bar rides along with whichever screen it belongs to
    if (owner) {
      const ownerAnim = owner === newEl ? plan.inn : plan.out;
      tabbar.hidden = false;
      tabbar.style.zIndex = owner === topEl ? 4 : 2;
      if (ownerAnim !== 'stay') tabbar.classList.add('anim-' + ownerAnim);
    } else {
      tabbar.hidden = !nowTabs;
    }

    const lead = plan.inn === 'stay' ? oldEl : newEl;
    let timer = null;
    const state = { after: null };
    const done = () => {
      if (anim !== state) return;
      anim = null;
      clearTimeout(timer);
      lead.removeEventListener('animationend', onEnd);
      if (oldEl.parentNode) oldEl.parentNode.removeChild(oldEl);
      newEl.classList.remove('is-anim', ...ANIM_CLASSES);
      newEl.style.zIndex = '';
      tabbar.classList.remove(...ANIM_CLASSES);
      tabbar.style.zIndex = '';
      tabbar.hidden = !nowTabs;
      if (state.after) state.after();
    };
    const onEnd = (e) => {
      if (e.target === lead) done();
    };
    state.finish = done;
    anim = state;
    lead.addEventListener('animationend', onEnd);
    // Fallback in case animationend never shows up (hidden tab, display none)
    timer = setTimeout(done, (DUR[t] || 300) + 250);
  }

  function finishAnim() {
    if (anim) {
      anim.after = null;
      anim.finish();
    }
  }

  // Re-render the current screen in place: no transition, same scroll, focus kept when we can
  function refresh() {
    if (!cur || !cur.el) return;
    if (anim) {
      anim.after = refresh;
      return;
    }
    const oldEl = cur.el;
    const scroll = saveScroll(oldEl);
    const focus = saveFocus(oldEl);
    const nav = navCount;
    const el = renderDef(cur);
    if (nav !== navCount) return;
    if (oldEl.parentNode) oldEl.parentNode.replaceChild(el, oldEl);
    else NC.dom.clear(view).appendChild(el);
    cur.el = el;
    restoreScroll(el, scroll);
    restoreFocus(el, focus);
    renderTabs();
  }

  const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function saveFocus(root) {
    const a = document.activeElement;
    if (!a || !root.contains(a) || a === root) return null;
    if (a.id) return { id: a.id };
    return { index: Array.from(root.querySelectorAll(FOCUSABLE)).indexOf(a) };
  }

  function restoreFocus(root, info) {
    if (!info) return;
    let target = null;
    if (info.id) target = root.querySelector('#' + CSS.escape(info.id));
    else if (info.index >= 0) target = root.querySelectorAll(FOCUSABLE)[info.index];
    if (target) target.focus({ preventScroll: true });
  }

  // Numbers add up into a count. A hook that returns true asks for a plain dot instead (like the
  // Rules "not set up yet" hint), and the dot only shows when there's no count to show
  function badgeCount(tabId) {
    const out = { count: 0, dot: false };
    NC.hooks.collect('tab-badge', tabId).forEach((n) => {
      if (n === true) out.dot = true;
      else if (typeof n === 'number' && n > 0) out.count += n;
    });
    return out;
  }

  function renderTabs() {
    if (!tabbar) return;
    const list = visibleTabs();
    const sig = list.map((t) => [t.id, t.label, t.icon, t.path].join(':')).join('|');
    if (sig !== tabSig) {
      tabSig = sig;
      NC.dom.clear(tabbar);
      list.forEach((t) => {
        const badge = NC.dom.h('span.tab-badge', { hidden: true, 'aria-hidden': 'true' });
        const btn = NC.dom.h('button.tab', { type: 'button', 'data-tab': t.id, onClick: () => onTab(t) },
          NC.dom.h('span.tab-icon', NC.icon(t.icon, { size: 26 }), badge),
          NC.dom.h('span.tab-label', t.label));
        tabbar.appendChild(btn);
      });
    }
    const active = cur && cur.def ? cur.def.tab : null;
    // Badge hooks read the user's data, so never ask them while logged out,
    // and skip the work on screens without tabs anyway
    const loggedOut = currentUser() === null;
    if (!loggedOut && !(cur && cur.def && cur.def.tab)) return;
    list.forEach((t) => {
      const btn = tabbar.querySelector('[data-tab="' + t.id + '"]');
      if (!btn) return;
      if (t.id === active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
      const b = loggedOut ? { count: 0, dot: false } : badgeCount(t.id);
      const n = b.count;
      const dot = !n && b.dot;
      const badge = btn.querySelector('.tab-badge');
      badge.hidden = !n && !dot;
      badge.classList.toggle('tab-badge--dot', dot);
      badge.textContent = n > 9 ? '9+' : n ? String(n) : '';
      btn.setAttribute('aria-label', n ? t.label + ', ' + n + (n === 1 ? ' new item' : ' new items') : dot ? t.label + ', new' : t.label);
    });
  }

  function onTab(t) {
    const onThisTab = cur && cur.def.tab === t.id;
    if (onThisTab && cur.path === t.path) {
      const body = cur.el.querySelector('.screen-body');
      if (body) body.scrollTo({ top: 0, behavior: NC.dom.reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    // Tapping your own tab from deep inside it pops back to the top, like iOS
    go(t.path, { transition: onThisTab ? 'back' : 'fade' });
  }

  function onStoreChange() {
    // A write made while a screen draws itself (like clearing "New" flags) is already on that
    // screen, and redrawing for it would just loop
    if (!rendering) storeDirty = true;
    if (storeQueued) return;
    storeQueued = true;
    const at = navCount;
    Promise.resolve().then(() => {
      storeQueued = false;
      const dirty = storeDirty;
      storeDirty = false;
      if (!cur) return;
      // Logged out (or account deleted) on a screen that needs a user, or just logged in on welcome / login
      const user = currentUser();
      const wrongSide = cur.def === PLACEHOLDER ? user === null : (cur.def.auth !== false && !user) || (cur.def.guestOnly && user);
      if (wrongSide) {
        const r = resolve(cur.full);
        if (r.full !== cur.full) {
          go(r.full, { replace: true, transition: 'fade' });
          return;
        }
      }
      renderTabs();
      if (dirty && navCount === at && cur.def.live) refresh();
    });
  }

  function placeholderScreen() {
    const { h } = NC.dom;
    return NC.c.screen({
      className: 'screen--placeholder',
      body: h('div.placeholder',
        h('span.app-mark.app-mark--lg', NC.icon('shield', { size: 40 })),
        h('h1.title-xl', 'NeedCheck'),
        h('p.lead', 'Screens are on the way')),
    });
  }

  // What people see before there's a /home: logged in before the Home part is in, they still get to their account
  function placeholderHome() {
    const user = currentUser();
    if (!user) return placeholderScreen();
    const { h } = NC.dom;
    const first = String(user.name || '').trim().split(/\s+/)[0];
    const account = has('/account') ? NC.c.button('Your account', { icon: 'user', onClick: () => go('/account') }) : null;
    return NC.c.screen({
      className: 'screen--placeholder',
      body: h('div.placeholder',
        h('span.app-mark.app-mark--lg', NC.icon('shield', { size: 40 })),
        h('h1.title-xl', first ? 'Hi, ' + first : 'NeedCheck'),
        h('p.lead', 'You\'re logged in. Checks, rules and receipts show up here soon.'),
        h('div.placeholder-actions',
          account,
          NC.c.button('Log out', { variant: account ? 'ghost' : 'secondary', icon: 'logout', onClick: logOutHere }))),
    });
  }

  function logOutHere() {
    const done = () => {
      // The store change sends us to welcome on its own
      NC.store.logOut();
      if (NC.ui && typeof NC.ui.toast === 'function') NC.ui.toast('Logged out', { tone: 'info', icon: 'logout' });
    };
    if (!(NC.ui && typeof NC.ui.confirm === 'function')) {
      done();
      return;
    }
    NC.ui.confirm({ title: 'Log out?', confirmLabel: 'Log out', icon: 'logout' }).then((yes) => {
      if (yes) done();
    });
  }

  function errorScreen() {
    return NC.c.screen({
      nav: NC.c.navBar({ back: true }),
      body: NC.c.empty({
        icon: 'alert',
        tone: 'amber',
        title: 'This screen hit a snag',
        text: 'Something went wrong while opening it. Going back usually helps.',
        action: NC.c.button('Go to home', { variant: 'secondary', block: false, onClick: () => go(fallbackPath() || '/home', { transition: 'fade' }) }),
      }),
    });
  }

  function current() {
    if (!cur) return null;
    return { path: cur.path, full: cur.full, params: cur.params, query: cur.query, def: cur.def };
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function start() {
    if (started) return;
    started = true;
    const app = NC.dom.appRoot();
    view = document.getElementById('view') || app.appendChild(NC.dom.h('main#view'));
    tabbar = document.getElementById('tabbar') || app.appendChild(NC.dom.h('nav#tabbar.tabbar', { 'aria-label': 'Tabs' }));

    // A reload keeps history.state, so we still know how deep into the app we are
    const st = history.state;
    if (st && typeof st.ncIdx === 'number') {
      idx = st.ncIdx;
      enteredWith = st.ncT || 'none';
    }
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    if (NC.store && typeof NC.store.on === 'function') NC.store.on(onStoreChange);

    const r = resolve(hashFull() === '/' ? '/home' : hashFull());
    writeHistory(r.full, true, { ncIdx: idx, ncT: enteredWith });
    show(r, 'none');
  }

  // A quick double tap shouldn't press whatever shows up under the finger on the next screen.
  // Only real taps are held, and only for a moment after a screen change
  document.addEventListener('click', (e) => {
    if (e.isTrusted && Date.now() < quietUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  NC.router = { add, addTab, go, back, popTo, backTo, refresh, has, current, onChange, start, updateTabs: renderTabs };
})();
