// Home: the greeting, this week's numbers, and the Priority list that every feature adds its cards to.
// Home itself only adds up what the hooks hand it, so a missing teammate file just means fewer cards.
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.dom || !NC.c || !NC.router) return;
  const { h } = NC.dom;
  const c = NC.c;

  function num(v) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function user() {
    try {
      return NC.store && typeof NC.store.currentUser === 'function' ? NC.store.currentUser() : null;
    } catch (e) {
      return null;
    }
  }

  function firstName(u) {
    const name = u && u.name ? String(u.name).trim() : '';
    return name ? name.split(/\s+/)[0] : 'there';
  }

  // The base numbers live in the requests slice, everything that happened since comes from the hooks
  function stats() {
    let base = null;
    try {
      const s = NC.store && typeof NC.store.get === 'function' ? NC.store.get('requests') : null;
      base = s && s.stats ? s.stats : null;
    } catch (e) {
      base = null;
    }
    const out = { checked: num(base && base.checkedBase), declined: num(base && base.declinedBase), waiting: 0 };
    NC.hooks.collect('home-stats').forEach((x) => {
      if (!x || typeof x !== 'object') return;
      out.checked += num(x.checked);
      out.declined += num(x.declined);
      out.waiting += num(x.waiting);
    });
    return out;
  }

  function cards() {
    return NC.hooks.collect('home-cards')
      .filter((x) => x && x.el instanceof Element)
      .map((x, i) => ({ el: x.el, p: typeof x.priority === 'number' ? x.priority : 50, i: i }))
      .sort((a, b) => a.p - b.p || a.i - b.i)
      .map((x) => x.el);
  }

  // dom.js has the shared check, the fallback is just for an older dom.js
  function reduced() {
    if (typeof NC.dom.reducedMotion === 'function') return NC.dom.reducedMotion();
    if (document.documentElement.classList.contains('reduce-motion')) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // "waiting for you" just takes them down to the list, and the label gets focus for keyboard folks
  function toPriority(screen) {
    const body = screen.querySelector('.screen-body');
    const target = screen.querySelector('.home-priority');
    if (!body || !target) return;
    body.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: reduced() ? 'auto' : 'smooth' });
    const label = target.querySelector('.section-label');
    if (label) {
      label.setAttribute('tabindex', '-1');
      label.focus({ preventScroll: true });
    }
    target.classList.remove('is-flash');
    void target.offsetWidth;
    target.classList.add('is-flash');
  }

  function openRequests() {
    if (NC.router.has('/requests')) NC.router.go('/requests');
  }

  function statButton(n, label, aria, onClick) {
    return h('button.home-stat', { type: 'button', 'aria-label': aria, onClick: onClick },
      h('span.home-stat-num', String(n)),
      h('span.home-stat-label', label));
  }

  function avatar(u) {
    const letter = firstName(u) === 'there' ? '?' : firstName(u)[0].toUpperCase();
    if (!NC.router.has('/account')) return h('span.home-avatar', { 'aria-hidden': 'true' }, letter);
    return h('button.home-avatar', { type: 'button', 'aria-label': 'Your account', onClick: () => NC.router.go('/account') }, letter);
  }

  function renderHome() {
    const u = user();
    const s = stats();
    const list = cards();
    let screen = null;
    const hasInbox = NC.router.has('/requests');

    const head = h('div.home-head',
      h('h1.home-hello',
        h('span.home-greet', NC.dom.greeting() + ','),
        h('span.home-name', firstName(u))),
      avatar(u));

    const week = c.card([
      h('p.label.home-week', 'This week'),
      h('div.home-stats',
        statButton(s.checked, 'asks checked', NC.dom.plural(s.checked, 'ask') + ' checked this week. See all requests', openRequests),
        statButton(s.declined, 'kept to what\'s needed', NC.dom.plural(s.declined, 'ask') + ' kept to what\'s needed this week. See all requests', openRequests),
        statButton(s.waiting, 'waiting for you', s.waiting + ' waiting for you. Jump to the list', () => toPriority(screen))),
    ], { tone: 'dark', className: 'home-card-week' });

    const seeAll = hasInbox
      ? h('button.link.home-see-all', { type: 'button', onClick: openRequests }, 'See all requests')
      : null;
    const body = list.length
      ? h('div.home-cards', list)
      : c.card(c.empty({
        icon: 'checkCircle',
        tone: 'green',
        title: 'You\'re all caught up',
        text: 'Nothing needs you right now. When an app asks for something, it\'ll show up here.',
        action: hasInbox ? c.button('See past requests', { variant: 'secondary', small: true, block: false, onClick: openRequests }) : null,
      }), { pad: false, className: 'home-empty' });

    screen = c.screen({
      className: 'home',
      body: [
        head,
        week,
        c.section('Priority', body, { action: list.length ? seeAll : null, className: 'home-priority' }),
      ],
    });
    return screen;
  }

  NC.router.addTab({ id: 'home', label: 'Home', icon: 'home', path: '/home', order: 1 });
  NC.router.add('/home', { tab: 'home', title: 'Home', live: true, render: renderHome });
})();
