// Onboarding: the swipeable cards that explain Check, Rules and Receipts right after sign up, and again from
// Account > How NeedCheck works. It's here because DP3 testers hadn't used tools like this (problems 1 and 4).
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.dom || !NC.c || !NC.router) return;

  const { h } = NC.dom;
  const c = NC.c;

  function icon(name, size) {
    return NC.icon(name, { size: size || 20 });
  }

  function appOf(id, fallback) {
    return NC.app ? NC.app(id) : fallback;
  }

  // Account remembers a link someone opened while logged out, so finishing the tour still takes them there
  function nextPath() {
    return NC.account && typeof NC.account.nextPath === 'function' ? NC.account.nextPath() : '/home';
  }

  // The cards are small pretend screens built from the real pieces, so the tour already looks like the app.
  // They're inert, since they're pictures to look at and nothing inside should be tapped or tabbed to
  function miniRow(iconName, tone, label, right, size) {
    return h('div.ob-row', c.iconTile(iconName, { tone, size: size || 30, shape: tone === 'cream' ? 'square' : 'circle' }), h('span.ob-row-label', label), right);
  }

  // The last row of a mock card is the first to go on very narrow phones, so the floating extras never cover it
  function extra(row) {
    row.classList.add('ob-row--extra');
    return row;
  }

  // Same asks as the real Temple Run request people open next, so the count on the card always matches
  const TEMPLE_ASKS = [
    { type: 'location', label: 'Location', icon: 'pin', verdict: 'not_needed' },
    { type: 'contacts', label: 'Contacts', icon: 'users', verdict: 'not_needed' },
    { type: 'notifications', label: 'Notifications', icon: 'bell', verdict: 'optional' },
    { type: 'email', label: 'Email', icon: 'mail', verdict: 'needed' },
  ];
  const VERDICT_TILE = { needed: 'green', optional: 'amber', not_needed: 'red' };

  function templeAsks() {
    let r = null;
    try {
      r = NC.requests && typeof NC.requests.get === 'function' ? NC.requests.get('temple-run') : null;
    } catch (e) {
      r = null;
    }
    return r && Array.isArray(r.asks) && r.asks.length ? r.asks : TEMPLE_ASKS;
  }

  function artCheck() {
    const temple = appOf('temple-run', { name: 'Temple Run', color: '#1B2340', icon: 'game' });
    const asks = templeAsks();
    const look = (a) => (NC.dataType ? NC.dataType(a.type) : a);
    const dense = asks.length > 3;
    return h('div.ob-art.ob-art--peach', { inert: true, 'aria-hidden': 'true' },
      h('div', { class: ['ob-card', dense ? 'ob-card--dense' : null] },
        h('div.ob-card-brand', c.iconTile('shield', { tone: 'brand', size: 24 }), h('span.ob-brand-name', 'NeedCheck'), h('span.ob-brand-when', '· just now')),
        h('div.ob-card-head', c.appTile(temple, { size: 40 }), h('div', h('p.ob-card-title', temple.name + ' is asking'), h('p.ob-card-sub', 'for ' + NC.dom.plural(asks.length, 'thing')))),
        asks.map((a) => miniRow(look(a).icon, VERDICT_TILE[a.verdict] || 'cream', look(a).label, c.verdict(a.verdict), dense ? 26 : 30))),
      h('span.ob-float.ob-float--btn', icon('check', 16), "Allow only what's needed"));
  }

  function artRules() {
    const on = () => c.toggle({ checked: true, label: 'On' });
    return h('div.ob-art.ob-art--green', { inert: true, 'aria-hidden': 'true' },
      h('div.ob-card',
        h('div.ob-card-head', c.iconTile('rules', { tone: 'white-primary', shape: 'square', size: 40 }), h('div', h('p.ob-card-title', 'Your rules'), h('p.ob-card-sub', 'Set once, used everywhere'))),
        miniRow('cookie', 'cream', 'Decline ad cookies', on()),
        miniRow('mail', 'cream', 'Mask my email', on()),
        extra(miniRow('cake', 'cream', 'Hide my birthday', on()))),
      h('span.ob-float.ob-float--note', icon('check', 16), "Answered CNN's cookie banner"));
  }

  function artReceipts() {
    const walmart = appOf('walmart', { name: 'Walmart', category: 'Shopping', color: '#2C7A7B', icon: 'bag' });
    return h('div.ob-art.ob-art--cream', { inert: true, 'aria-hidden': 'true' },
      h('div.ob-card',
        h('div.ob-card-head', c.appTile(walmart, { size: 40 }), h('div', h('p.ob-card-title', walmart.name), h('p.ob-card-sub', (walmart.category || 'Shopping') + ' · Joined ' + NC.dom.fmtDate(NC.dom.daysAgo(39), 'short')))),
        h('p.ob-card-label', 'They have:'),
        // Same chips as the real Walmart receipt: email stays Needed, the rest show what changed
        miniRow('mail', 'cream', 'Email', c.verdict('needed')),
        miniRow('phone', 'cream', 'Phone number', c.status('masked')),
        extra(miniRow('cookie', 'cream', 'Ad cookies', c.status('off')))),
      h('span.ob-float.ob-float--tile', c.iconTile('receipt', { tone: 'accent', shape: 'square', size: 46 })));
  }

  // Each card names a route (needs) that only exists once that part of the app is in
  const SLIDES = [
    { art: artCheck, needs: '/check/temple-run', tab: 'home', where: 'On the Home tab', title: 'Check before you allow', text: 'When an app asks for your data, we explain each ask and mark it Needed, Optional or Not needed.' },
    { art: artRules, needs: '/rules', tab: 'rules', where: 'On the Rules tab', title: 'Set your rules once', text: 'Choose how to answer cookie banners and sign-up forms one time. NeedCheck handles them after that.' },
    { art: artReceipts, needs: '/receipts', tab: 'receipt', where: 'On the Receipts tab', title: 'Take back what you shared', text: 'Every yes leaves a receipt. Open one to turn things off or ask a company to delete your data.' },
  ];

  // Only cards for parts that are really in this build, so the tour never points at a tab that isn't there
  function tourSlides() {
    return SLIDES.filter((s) => NC.router.has(s.needs));
  }

  // The frame is scaled down on desktop, so drag distances are divided back to phone pixels (Danyal's dom.js works it out)
  function frameScale() {
    return typeof NC.dom.frameScale === 'function' ? NC.dom.frameScale() : 1;
  }

  function onboardingScreen(params, query) {
    const replay = !!(query && query.replay);
    const cards = tourSlides();
    // Nothing to show yet, so skip straight to where they were going instead of an empty tour
    if (!cards.length) {
      NC.router.go(replay ? '/account' : nextPath(), { replace: true });
      return null;
    }
    const last = cards.length - 1;
    let index = 0;

    const slides = cards.map((s, i) => h('div.ob-slide', {
      role: 'group',
      'aria-roledescription': 'card',
      'aria-label': (i + 1) + ' of ' + cards.length,
    },
    s.art(),
    h('p.ob-where', icon(s.tab, 16), s.where),
    h('h2.title-lg.ob-title', s.title),
    h('p.lead.ob-text', s.text)));

    const track = h('div.ob-track', slides);
    const viewport = h('div.ob-viewport', { role: 'region', 'aria-label': 'How NeedCheck works' }, track);
    const dots = slides.map((s, i) => h('button.ob-dot', { type: 'button', 'aria-label': 'Show card ' + (i + 1) + ' of ' + cards.length, onClick: () => goTo(i) }));
    const live = h('p.sr-only', { 'aria-live': 'polite' });
    const finishLabel = replay ? 'Done' : 'Get started';
    const nextBtn = c.button('Next', { onClick: () => (index < last ? goTo(index + 1, true) : finish()) });
    const skipBtn = replay ? null : c.button('Skip', { variant: 'ghost', small: true, block: false, className: 'ob-skip', onClick: finish });
    // New accounts open on the demo history, so say so on every card (Skip can leave from card 1).
    // It sits with the button in the footer, so a short phone or Larger text can't push it out of view
    const sample = replay ? null : h('p.ob-sample', 'Your account starts with sample apps and receipts to try things on. Reset them any time in Account.');

    function place(dx) {
      track.style.transform = 'translateX(calc(' + (-100 * index) + '% + ' + (dx || 0) + 'px))';
    }

    // Cards off to the side get inert, so a screen reader only reads the one on screen
    function goTo(i, announce) {
      index = Math.max(0, Math.min(last, i));
      place(0);
      slides.forEach((s, k) => {
        s.toggleAttribute('inert', k !== index);
        s.setAttribute('aria-hidden', String(k !== index));
      });
      dots.forEach((d, k) => {
        d.classList.toggle('is-on', k === index);
        if (k === index) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
      nextBtn.querySelector('.btn-label').textContent = index === last ? finishLabel : 'Next';
      if (skipBtn) skipBtn.style.visibility = index === last ? 'hidden' : '';
      if (announce !== false) live.textContent = 'Card ' + (index + 1) + ' of ' + cards.length + ': ' + cards[index].title;
    }

    function finish() {
      if (replay) NC.router.back('/account');
      else NC.router.go(nextPath(), { replace: true, transition: 'fade' });
    }

    // Swiping uses pointer events. We only take over once the drag is clearly sideways,
    // so scrolling up and down on a short phone still works
    let drag = null;
    viewport.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      drag = { x: e.clientX, y: e.clientY, t: Date.now(), dx: 0, on: false, id: e.pointerId, k: frameScale() };
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = (e.clientX - drag.x) / drag.k;
      const dy = (e.clientY - drag.y) / drag.k;
      if (!drag.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          drag = null;
          return;
        }
        if (Math.abs(dx) < 8) return;
        drag.on = true;
        drag.t = Date.now();
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch (err) {
          // Capture is a nice extra, the drag still works without it
        }
        track.classList.add('is-dragging');
      }
      // A bit of rubber band past the first and last card, so the edge feels like an edge
      const edge = (index === 0 && dx > 0) || (index === last && dx < 0);
      drag.dx = edge ? dx * 0.35 : dx;
      place(drag.dx);
    });
    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!d.on) return;
      track.classList.remove('is-dragging');
      const speed = Math.abs(d.dx) / Math.max(1, Date.now() - d.t);
      const far = Math.abs(d.dx) > 60 || (Math.abs(d.dx) > 24 && speed > 0.45);
      if (far && d.dx < 0) goTo(index + 1);
      else if (far && d.dx > 0) goTo(index - 1);
      else goTo(index, false);
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    // On touch, the finger starts captured by whatever it landed on, and that element losing it
    // bubbles up here too, so only our own capture ending should count as the end of a swipe
    viewport.addEventListener('lostpointercapture', (e) => {
      if (e.target === viewport) endDrag();
    });

    const el = c.screen({
      nav: c.navBar({ back: replay ? '/account' : false, right: skipBtn }),
      className: 'ob-screen',
      body: h('div.ob-wrap',
        h('h1.sr-only', replay ? 'How NeedCheck works' : 'Welcome to NeedCheck'),
        viewport,
        cards.length > 1 ? h('div.ob-dots', dots) : null,
        live),
      footer: [sample, nextBtn],
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else return;
      e.preventDefault();
    });
    goTo(0, false);
    return el;
  }

  // Account asks for the count before offering "How NeedCheck works", so the row only shows when there's a tour
  NC.onboarding = { count: () => tourSlides().length };

  // The tour is for people with an account, so it waits for the store like the account screens do
  if (!NC.store) return;
  NC.router.add('/onboarding', { tab: null, title: 'Welcome to NeedCheck', render: onboardingScreen });
})();
