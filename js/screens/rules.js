// task 2 screens, the rules tab
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.rules || !NC.router || !NC.c) return;
  const { h } = NC.dom;
  const c = NC.c;
  const R = NC.rules;

  function clone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function readPath(obj, path) {
    return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function writePath(obj, path, value) {
    let o = obj;
    path.slice(0, -1).forEach((k) => {
      if (!o[k] || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    });
    o[path[path.length - 1]] = value;
  }

  function toast(msg, opts) {
    if (NC.ui && NC.ui.toast) return NC.ui.toast(msg, opts);
    return null;
  }

  // no pop-up to ask with means nothing to stop, so we just go ahead
  function ask(o) {
    return NC.ui && NC.ui.confirm ? NC.ui.confirm(o) : Promise.resolve(true);
  }

  // app names and data words are bianca's, so fall back to the raw id
  function appName(id) {
    return NC.app ? NC.app(id).name : id;
  }

  function typeLabel(t) {
    return NC.dataType ? NC.dataType(t).label : t;
  }

  // every toggle in setup and on the detail pages. sub is the plain "what changes for you" line
  const T = {
    declineAds: {
      path: ['cookies', 'declineAds'], icon: 'cookie', title: 'Decline ad cookies', ask: 'What are ad cookies?', term: 'adCookies',
      sub: 'Stops ads that follow you to other sites',
      text: "Ad cookies let ad companies follow you from site to site. That's why something you looked at once keeps showing up in your feed.",
      example: "You read a story on CNN. NeedCheck says no to its ad cookies, so CNN's ad partners never learn you were there.",
    },
    declineAnalytics: {
      path: ['cookies', 'declineAnalytics'], icon: 'cookie', title: 'Decline analytics cookies', ask: 'What are analytics cookies?', term: 'analyticsCookies',
      sub: "Sites can't count every page you visit",
      text: 'Analytics cookies tell a site how you use it: which pages you open, how long you stay and what you tap. Saying no never breaks the site.',
      example: "A shopping site works the same. It just doesn't get a report of everything you looked at.",
    },
    keepLogin: {
      path: ['cookies', 'keepLogin'], icon: 'lock', title: 'Keep cookies that log you in', ask: 'What are login cookies?', term: 'loginCookies',
      sub: 'So sites remember your login and cart',
      text: 'These cookies keep you logged in and remember your cart. Without them you would log in again on every visit, so most people keep them on.',
      example: 'You add shoes to your Adidas cart, close the tab, and they are still there tomorrow.',
    },
    flagSneaky: {
      path: ['cookies', 'flagSneaky'], icon: 'info', title: 'Flag sneaky cookie banners', ask: 'What is a sneaky cookie banner?', term: 'sneakyBanners',
      sub: 'Warns you when "Decline" is hidden',
      text: 'Some banners make "Accept" big and bright and hide "Decline" behind extra taps. NeedCheck points these out so you are not pushed into saying yes.',
      example: 'A site only shows "Accept all" and "Settings". NeedCheck tells you the decline button is two taps deep and answers it for you.',
    },
    maskEmail: {
      path: ['contact', 'maskEmail'], icon: 'mail', title: 'Mask my email', ask: "What's a masked email?",
      sub: 'Shops and games get a stand-in address',
      text: (m) => 'Sites get a stand-in address like ' + m.email + '. Their emails still reach your inbox, but they never learn your real address, and you can switch it off any time.',
      example: 'You sign up for Walmart. Walmart gets the stand-in address, and your order emails still land in your normal inbox.',
    },
    maskPhone: {
      path: ['contact', 'maskPhone'], icon: 'phone', title: 'Mask my phone number', ask: "What's a masked phone number?",
      sub: 'Only banks and sign-in codes get the real one',
      text: (m) => "Sites that don't need to call you get a stand-in number, " + m.phone + '. Texts to it are passed on to you. Your real number still goes where it is truly needed, like your bank and sign-in codes.',
      example: 'A game asks for your number to "find friends". It gets the stand-in, so your real number never lands on a marketing list.',
    },
    skipOptional: {
      path: ['contact', 'skipOptional'], icon: 'file', title: 'Skip optional sign-up fields', ask: 'What are optional fields?', term: 'optionalFields',
      sub: 'Like birthday and gender',
      text: "Sign-up forms often ask for extras they don't need, like your birthday or gender. NeedCheck leaves those boxes empty and fills in only what's required.",
      example: "A store's sign-up form has 9 boxes but only 3 are required. NeedCheck fills those 3 and skips the rest.",
    },
    maps: {
      path: ['location', 'maps'], icon: 'map', title: 'Maps & rides', ask: 'Why do maps and rides get my location?', sub: 'Like Google Maps and Uber',
      text: "Directions and pickups need to know where you are, so these apps get your location, but only while you're using them.",
      example: "Uber can find you for a pickup. It can't follow you around after you close the app.",
    },
    food: {
      path: ['location', 'food'], icon: 'food', title: 'Food delivery', ask: 'Why does food delivery get my location?', sub: 'Like DoorDash',
      text: 'Delivery apps use your location to find places near you and send the driver to the right door.',
      example: 'DoorDash sees where you are while you order, then stops.',
    },
    games: {
      path: ['location', 'games'], icon: 'game', title: 'Games', ask: 'Do games need my location?', sub: 'Like Temple Run and Candy Crush',
      text: 'Most games work fine without your location. They usually want it for ads or nearby leaderboards.',
      example: 'Temple Run asks for your location for a leaderboard. With this off, NeedCheck says no and the game still works.',
    },
    shopping: {
      path: ['location', 'shopping'], icon: 'bag', title: 'Shopping', ask: 'Do shopping apps need my location?', sub: 'Like Walmart and Shein',
      text: 'Shopping apps can find a store or check delivery with your zip code. Your exact location mostly helps them pick ads.',
      example: 'Walmart asks for your location. NeedCheck says no, and you can still type a zip code to find a store.',
    },
    social: {
      path: ['location', 'social'], icon: 'chat', title: 'Social media', ask: 'Do social apps need my location?', sub: 'Like Snapchat',
      text: 'Social apps use location to show friends where you are and to pick ads for you. You can still share a place by hand when you want to.',
      example: 'Snapchat asks for your location. NeedCheck says no, and you can still tag a place yourself.',
    },
    hideBirthday: {
      path: ['hideBirthday'], icon: 'cake', title: 'Hide my birthday by default', ask: 'Why hide my birthday?',
      sub: "Apps won't get it unless you say so",
      text: 'Your birthday is often used to check who you are, which makes it useful to scammers. NeedCheck leaves it out unless you say an app can have it.',
      example: 'A shopping site asks for your birthday "for a gift". NeedCheck leaves it blank. Your bank can still get it if you say yes.',
    },
  };

  const STEPS = [
    {
      n: 1, name: 'Cookies', label: 'Cookie banners', icon: 'cookie', next: 'Next: Contact info',
      question: 'How should we answer cookie banners?',
      helper: 'Most sites ask the moment you arrive. Turn on what fits you.',
      line: 'How to answer "Accept cookies?" pop-ups',
      groups: [['declineAds', 'declineAnalytics', 'keepLogin', 'flagSneaky']],
    },
    {
      n: 2, name: 'Contact info', label: 'Contact info', icon: 'mail', next: 'Next: Location and birthday',
      question: 'Who gets your real number and email?',
      helper: 'Masked versions still reach you, and you can turn them off any time.',
      line: 'Who gets your real email and phone number',
      groups: [['maskEmail', 'maskPhone', 'skipOptional']],
    },
    {
      // the birthday switch sits here like dp3, so the step is named after both
      n: 3, name: 'Location and birthday', label: 'Location and birthday', icon: 'pin', next: 'Review my rules',
      question: 'Which apps can use your location?',
      helper: "Only while you're using them. Every other app gets a no.",
      line: 'Which apps may use where you are, and who sees your birthday',
      groups: [['maps', 'food', 'games', 'shopping', 'social'], ['hideBirthday']],
      groupLabels: [null, 'Birthday'],
    },
  ];
  const STEP_NAMES = STEPS.map((s) => s.name);

  const CATEGORIES = [
    {
      key: 'cookies', title: 'Cookie banners', icon: 'cookie', toggles: ['declineAds', 'declineAnalytics', 'keepLogin', 'flagSneaky'],
      about: 'When a site pops up an "Accept cookies?" banner, NeedCheck answers it for you with these settings.',
    },
    {
      key: 'phone', title: 'Phone number', icon: 'phone', toggles: ['maskPhone'],
      about: 'Sites that only want your number for ads or "finding friends" get your stand-in number. Banks and sign-in codes still get the real one.',
    },
    {
      key: 'email', title: 'Email', icon: 'mail', toggles: ['maskEmail'],
      about: 'Shopping, games and newsletter sign-ups get your stand-in address. Their emails still reach your inbox.',
    },
    {
      key: 'location', title: 'Location', icon: 'pin', toggles: ['maps', 'food', 'games', 'shopping', 'social'],
      about: 'Only the kinds of apps you turn on here can use where you are, and only while you use them. Everything else gets a no.',
    },
    {
      key: 'birthday', title: 'Birthday', icon: 'cake', toggles: ['hideBirthday', 'skipOptional'],
      about: 'Sign-up forms ask for your birthday far more than they need it. NeedCheck keeps it out unless you say so.',
    },
  ];
  const CAT = {};
  CATEGORIES.forEach((x) => { CAT[x.key] = x; });

  const LOC_WORDS = { maps: ['maps', 'rides'], food: ['delivery'], games: ['games'], shopping: ['shopping'], social: ['social media'] };

  function cap(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  function locationWords(v) {
    return Object.keys(LOC_WORDS).filter((k) => v.location[k]).reduce((a, k) => a.concat(LOC_WORDS[k]), []);
  }

  // the gray line under each rule on the rules tab
  function summary(key, v) {
    if (key === 'cookies') {
      const ck = v.cookies;
      if (ck.declineAds && ck.declineAnalytics) return 'Decline ads, tracking, analytics';
      if (ck.declineAds) return 'Decline ad and tracking cookies';
      if (ck.declineAnalytics) return 'Decline analytics cookies';
      return 'Flag sneaky banners';
    }
    if (key === 'phone' || key === 'email') return 'Masked for low-stakes sign-ups';
    if (key === 'location') return cap(NC.dom.listText(locationWords(v))) + ' only';
    if (key === 'birthday') return v.hideBirthday ? 'Hidden by default' : 'Optional fields skipped';
    return '';
  }

  // what the review screen and "your rules are on" list out
  function whatWeDo(v) {
    const out = [];
    const ck = v.cookies;
    if (ck.declineAds && ck.declineAnalytics) out.push('Decline ad, tracking and analytics cookies on every site');
    else if (ck.declineAds) out.push('Decline ad and tracking cookies on every site');
    else if (ck.declineAnalytics) out.push('Decline analytics cookies on every site');
    // keeping login cookies is the normal case, so it only gets a line when it's switched off
    if ((ck.declineAds || ck.declineAnalytics) && !ck.keepLogin) out.push("Decline login cookies too, so you'll log in on each visit");
    if (ck.flagSneaky) out.push('Warn you about sneaky cookie banners');
    const ct = v.contact;
    if (ct.maskEmail && ct.maskPhone) out.push('Use your masked email and number for low-stakes sign-ups');
    else if (ct.maskEmail) out.push('Use your masked email for low-stakes sign-ups');
    else if (ct.maskPhone) out.push('Use your masked number for low-stakes sign-ups');
    if (ct.skipOptional && v.hideBirthday) out.push('Skip optional fields, like your birthday');
    else if (ct.skipOptional) out.push('Skip optional sign-up fields, like gender');
    else if (v.hideBirthday) out.push('Keep your birthday hidden unless you say so');
    const loc = locationWords(v);
    if (loc.length) out.push('Let only ' + NC.dom.listText(loc) + ' apps use your location');
    if (out.length) out.push('Only interrupt you when an app asks for more than this');
    return out;
  }

  // short version for the "your rules are on" screen, one line per rule on
  function nowAutomatic(r) {
    const v = R.values(r);
    const on = (k) => R.isOn(r, k);
    const out = [];
    // flagging alone doesn't answer anything, so it gets its own line
    if (on('cookies')) {
      const ck = v.cookies;
      out.push({ icon: 'cookie', text: ck.declineAds || ck.declineAnalytics ? 'Cookie banners answered for you' : 'Sneaky cookie banners flagged' });
    }
    if (on('email') && on('phone')) out.push({ icon: 'mask', text: 'Masked email and number on sign-ups' });
    else if (on('email')) out.push({ icon: 'mail', text: 'Masked email on sign-ups' });
    else if (on('phone')) out.push({ icon: 'phone', text: 'Masked number on sign-ups' });
    if (on('location')) out.push({ icon: 'pin', text: 'Location only for ' + NC.dom.listText(locationWords(v)) });
    if (on('birthday')) {
      let t = 'Optional sign-up fields skipped';
      if (v.hideBirthday && v.contact.skipOptional) t = 'Birthday and optional fields left out';
      else if (v.hideBirthday) t = 'Birthday kept private';
      out.push({ icon: 'cake', text: t });
    }
    return out;
  }

  // which screen sat at each history step, so phone back after saving can hop past the old setup pages
  const visited = {};
  const visitedFull = {};
  // where in history the screen on show sits, so we can tell a back press from a forward one
  let shownIdx = null;
  let lastOutside = { path: '/rules' };
  const SETUP_RE = /^\/rules\/(setup(\/\d)?|review)$/;

  function idxNow() {
    const st = history.state;
    return st && typeof st.ncIdx === 'number' ? st.ncIdx : null;
  }

  // pops back to a screen we already have
  function popTo(path, transition) {
    if (typeof NC.router.popTo === 'function') NC.router.popTo(path, transition || 'back');
    else NC.router.go(path, { transition: transition || 'back' });
  }

  function backTo(path) {
    if (typeof NC.router.backTo === 'function') NC.router.backTo(path);
    else NC.router.go(path, { replace: true, transition: 'back' });
  }

  // draft lives here until they hit save
  let draft = null;

  function readDraft() {
    if (draft) return draft;
    const r = R.get();
    if (r && r.draft && r.draft.values) draft = r.draft;
    return draft;
  }

  function writeDraft() {
    const d = draft ? clone(draft) : null;
    R.update((r) => { r.draft = d; });
  }

  function clearDraft() {
    draft = null;
    R.update((r) => { r.draft = null; });
  }

  // a paused rule shows as off in setup, so the review matches what will really happen
  function currentValues() {
    const r = R.get();
    const v = R.values(r);
    if (!r || !r.configured) return v;
    const p = r.paused || {};
    const f = R.fresh();
    if (p.cookies) v.cookies = f.cookies;
    if (p.phone) v.contact.maskPhone = false;
    if (p.email) v.contact.maskEmail = false;
    if (p.location) v.location = f.location;
    if (p.birthday) {
      v.hideBirthday = false;
      v.contact.skipOptional = false;
    }
    return v;
  }

  function startDraft(values, via, entry) {
    draft = { values: clone(values), via: via, entry: entry, from: lastOutside.path };
    writeDraft();
    return draft;
  }

  function ensureDraft() {
    return readDraft() || startDraft(currentValues(), 'steps', 'direct');
  }

  // dirty = different from what's saved right now. so an unsaved "use recommended" counts too
  function isDirty() {
    const d = readDraft();
    return !!d && JSON.stringify(d.values) !== JSON.stringify(currentValues());
  }

  function leaveSetup() {
    const d = readDraft();
    const to = (d && d.from) || lastOutside.path || '/rules';
    const leave = () => {
      clearDraft();
      popTo(to);
    };
    if (!isDirty()) {
      leave();
      return;
    }
    ask({
      title: 'Leave setup?',
      message: "Your choices so far won't be saved.",
      confirmLabel: 'Leave',
      cancelLabel: 'Keep going',
      danger: true,
      icon: 'rules',
    }).then((ok) => {
      if (ok) leave();
    });
  }

  function closeButton() {
    return c.iconButton('x', { label: 'Leave setup', onClick: leaveSetup });
  }

  // opens the glossary pop up when bianca's help has the word, otherwise our own sheet
  function openHelp(term, fallback) {
    if (term && NC.help && typeof NC.help.explain === 'function') {
      let opened = null;
      try {
        opened = NC.help.explain(term);
      } catch (e) {
        console.error('help pop-up failed', e);
      }
      // explain() hands back the sheet, or nothing for a word it doesn't know
      if (opened) return;
    }
    fallback();
  }

  // our words in bianca's help pop-up, so every (i) in the app is the same sheet
  function explainSheet(o) {
    if (NC.help && typeof NC.help.show === 'function') {
      let opened = null;
      try {
        opened = NC.help.show({ icon: o.icon, title: o.title, text: o.text, example: o.example });
      } catch (e) {
        console.error('help pop-up failed', e);
      }
      if (opened) return;
    }
    if (!NC.ui || !NC.ui.sheet) return;
    NC.ui.sheet({
      label: o.title,
      className: 'help-sheet',
      body: [
        h('div.help-top', c.iconTile(o.icon || 'info', { tone: 'peach', size: 48 })),
        h('h2.title-lg.help-title', o.title),
        h('p.help-text', o.text),
        o.example ? h('div.help-example', h('p.help-label', 'For example'), h('p', o.example)) : null,
      ],
      footer: (s) => c.button('Got it', { variant: 'dark', onClick: () => s.close('button') }),
    });
  }

  // cookie and sign up words open the same glossary entry as everywhere else. the mask switches
  function explainToggle(t) {
    const own = () => explainSheet({ icon: t.icon, title: t.ask, text: typeof t.text === 'function' ? t.text(R.masked()) : t.text, example: t.example });
    if (t.term) openHelp(t.term, own);
    else own();
  }

  function explainMasking() {
    const m = R.masked();
    openHelp('masking', () => explainSheet({
      icon: 'mask',
      title: 'What does masking mean?',
      text: 'Masking means sites get a stand-in email or number instead of your real one. Anything they send still reaches you, but they never learn your real details, and you can switch it off any time.',
      example: 'Walmart gets ' + m.email + ' and ' + m.phone + '. Their order emails and texts still come to you.',
    }));
  }

  // emails can break after the @ on a tiny screen
  function addressText(value) {
    const at = String(value).indexOf('@');
    return at < 0 ? value : [value.slice(0, at + 1), h('wbr'), value.slice(at + 1)];
  }

  // stand-in and sign-ups shouldn't break at the hyphen
  function keepHyphens(text) {
    return String(text).split(/(\S+-\S+)/).map((part, i) => (i % 2 ? h('span.rt-nw', part) : part));
  }

  // one toggle row: tile, title, the plain line with a small info button at the end, and the
  // "Our pick" tag on its own line under it, so the plain line keeps the full width
  function toggleRow(key, checked, onChange, opts) {
    const t = T[key];
    const o = opts || {};
    const base = (o.prefix || 'rt') + '-' + key;
    const toggle = c.toggle({
      id: base,
      checked: checked,
      labelledBy: base + '-t',
      describedBy: (o.pick ? base + '-p ' : '') + base + '-s',
      disabled: o.disabled,
      onChange: onChange,
    });
    const info = h('button.rt-info', {
      type: 'button',
      'aria-label': 'What does ' + t.title + ' mean?',
      onClick: () => explainToggle(t),
    }, NC.icon('info', { size: 18 }));
    const pick = o.pick ? c.chip('Our pick', { tone: 'primary-soft', className: 'rt-pick' }) : null;
    // the last two words ride with the info button, so neither the icon nor a lone "Like" ends up on a line by itself
    const words = t.sub.split(' ');
    const lead = words.length > 2 ? words.slice(0, -2).join(' ') + ' ' : '';
    const tail = words.slice(-2).join(' ');
    if (pick) pick.id = base + '-p';
    const el = h('div', { class: ['rt', o.disabled ? 'is-disabled' : null] },
      c.iconTile(t.icon, { shape: 'square', size: 40 }),
      h('div.rt-main',
        h('p.rt-title', { id: base + '-t' }, t.title),
        h('p.rt-sub', keepHyphens(lead), h('span.rt-tail', tail, info), h('span.sr-only', { id: base + '-s' }, t.sub)),
        pick ? h('div.rt-pick-row', pick) : null),
      toggle);
    el.toggle = toggle;
    return el;
  }

  function isPick(key) {
    return !!readPath(R.recommended(), T[key].path);
  }

  
  function maskedCard(extra) {
    const m = R.masked();
    return c.card([
      h('p.rl-ph-head', NC.icon('mask', { size: 22 }), 'Your masked details'),
      h('p.rl-ph-note', 'Sites get these when a Mask switch above is on.'),
      h('p.rl-ph-line', addressText(m.email)),
      h('p.rl-ph-line', m.phone),
      extra || null,
    ], { tone: 'cream', className: 'rl-ph-mini' });
  }

  function iso() {
    return new Date().toISOString();
  }

  // routes

  NC.router.addTab({ id: 'rules', label: 'Rules', icon: 'rules', path: '/rules', order: 2 });

  // ids that were new when this visit started, so the chip survives redraws until they leave
  const seenNew = new Set();
  let topNext = false;
  // ?added=<id> gets used once: highlight + toast, then it's dropped from the address
  let highlight = null;
  // toasts from the rules tab itself. they close when you open a rule, so they never cover its back button
  let tabToast = null;

  // let the switch finish sliding before the screen redraws. quick taps on one switch
  // restart its timer, so only the last one counts and it applies once
  const pending = {};
  function deferred(key, fn) {
    clearTimeout(pending[key]);
    pending[key] = setTimeout(() => {
      delete pending[key];
      fn();
    }, 200);
  }

  // the switches already show what changed
  let sayEl = null;
  function say(msg) {
    if (!sayEl || !sayEl.isConnected) {
      sayEl = h('p.sr-only', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(sayEl);
    }
    sayEl.textContent = '';
    setTimeout(() => { sayEl.textContent = msg; }, 60);
  }

  // the little "Saved" next to settings on a detail page. kept here because the page redraws on every change
  let flash = null;
  function savedNote(key) {
    if (!flash || flash.key !== key) return null;
    const age = Date.now() - flash.at;
    if (age > 2600) return null;
    return h('span.rl-saved-note', { 'aria-hidden': 'true', style: { animationDelay: -age + 'ms' } },
      NC.icon('check', { size: 16, stroke: 2.6 }), flash.text);
  }

  // from a detail page it stays quiet (the page shows the change), from the list it's a toast
  function setCategory(key, on, onDetail) {
    R.update((r) => {
      r.paused[key] = !on;
      if (on && !R.settingsOn(r, key)) Object.assign(r, R.applyPicks(R.values(r), key));
    });
    const title = CAT[key].title;
    let msg = on ? title + ' rule is on' : title + ' rule is off. NeedCheck will ask you.';
    if (on && key === 'cookies') {
      const done = R.handleCookieBanners();
      if (done.length) {
        msg = 'Cookie banners rule is on. It answered ' + NC.dom.plural(done.length, 'banner') + ' for you.';
        flash = { key: key, at: Date.now(), text: 'Answered ' + NC.dom.plural(done.length, 'banner') };
      }
    }
    if (onDetail) say(msg);
    else tabToast = toast(msg, { tone: on ? 'success' : 'info' });
  }

  function statusCard(r) {
    const anyOn = R.CATS.some((k) => R.isOn(r, k));
    const customs = r.custom.filter((x) => x.on).length;
    let tone = 'peach';
    let tile = c.iconTile('info', { tone: 'white', size: 42 });
    let title = 'No rules yet';
    let text = 'Right now NeedCheck asks you about everything.';
    if (r.configured && anyOn) {
      tone = 'green';
      tile = c.iconTile('shield', { tone: 'white-green', size: 42 });
      title = 'Rules are on';
      text = 'NeedCheck answers for you and only asks when something is off.';
    } else if (r.configured) {
      tone = 'cream';
      title = 'Your rules are off';
      text = 'NeedCheck asks you about everything until you turn a rule back on.';
    } else if (customs) {
      title = 'Finish setting up';
      text = 'You have ' + NC.dom.plural(customs, 'rule') + ' so far. Set up the rest so NeedCheck can answer cookie banners and sign-ups too.';
    }
    return c.card(h('div.rl-status', tile, h('div.rl-status-text', h('p.card-title', title), h('p.card-text', text))), { tone: tone, className: 'rl-status-card' });
  }

  function catRow(cat, r) {
    if (!r.configured) {
      return c.row({ left: NC.icon(cat.icon, { size: 22 }), title: cat.title, right: c.chip('Ask me', { tone: 'cream' }), className: 'rl-row' });
    }
    const on = R.isOn(r, cat.key);
    const sub = on ? summary(cat.key, R.values(r)) : 'Off. NeedCheck asks you each time';
    const toggle = c.toggle({
      id: 'rule-' + cat.key,
      checked: on,
      label: cat.title + ' rule',
      onChange: (v) => deferred('cat-' + cat.key, () => {
        // tapped back to where it started, nothing to do
        if (R.isOn(R.get(), cat.key) !== v) setCategory(cat.key, v);
      }),
    });
    return h('div', { class: ['rrow', on ? null : 'is-off'] },
      h('button.rrow-main', {
        type: 'button',
        'aria-label': cat.title + '. ' + sub + '. Open details',
        onClick: () => NC.router.go('/rules/category/' + cat.key),
      },
      h('span.rrow-icon', NC.icon(cat.icon, { size: 22 })),
      h('span.rrow-text', h('span.rrow-title', cat.title, NC.icon('chev', { size: 16, className: 'rrow-chev' })), h('span.rrow-sub', keepHyphens(sub)))),
      toggle);
  }

  function customRow(rule, highlight) {
    const showNew = highlight || seenNew.has(rule.id);
    const toggle = c.toggle({
      id: 'rule-' + rule.id,
      checked: !!rule.on,
      label: rule.title + ' rule',
      onChange: (v) => deferred('custom-' + rule.id, () => {
        const cur = R.getCustom(rule.id);
        if (!cur || !!cur.on === v) return;
        R.setCustomOn(rule.id, v);
        tabToast = toast(rule.title + (v ? ' rule is on' : ' rule is off'), { tone: v ? 'success' : 'info' });
      }),
    });
    return h('div', { class: ['rrow', 'rrow--custom', highlight ? 'is-highlight' : null, rule.on ? null : 'is-off'], 'data-rule': rule.id },
      h('button.rrow-main', {
        type: 'button',
        'aria-label': rule.title + (showNew ? ', new' : '') + '. ' + (rule.desc || '') + '. Open details',
        onClick: () => NC.router.go('/rules/category/' + encodeURIComponent(rule.id)),
      },
      h('span.rrow-icon', NC.icon(rule.icon || 'rules', { size: 22 })),
      h('span.rrow-text',
        h('span.rrow-title', rule.title, NC.icon('chev', { size: 16, className: 'rrow-chev' }), showNew ? c.chip('New', { tone: 'new', className: 'rrow-new' }) : null),
        rule.desc ? h('span.rrow-sub', rule.desc) : null)),
      toggle);
  }

  function copyText(value, done) {
    const ok = () => toast(done, { tone: 'success', icon: 'copy' });
    const fallback = () => {
      // older browsers and file:// sometimes say no to the clipboard api
      const ta = h('textarea', { 'aria-hidden': 'true', readonly: true, style: 'position:fixed;top:-100px;left:0;opacity:0' });
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      let worked = false;
      try {
        worked = document.execCommand('copy');
      } catch (e) {
        worked = false;
      }
      ta.remove();
      if (worked) ok();
      else toast("Couldn't copy. Press and hold the text to copy it.", { tone: 'info' });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(ok, fallback);
    else fallback();
  }

  function maskedLine(icon, label, value, copyLabel) {
    return h('div.rl-ph-row',
      h('span.rl-ph-icon', NC.icon(icon, { size: 20 })),
      h('div.rl-ph-text', h('span.rl-ph-label', label), h('span.rl-ph-value', addressText(value))),
      c.iconButton('copy', { label: 'Copy ' + copyLabel, variant: 'circle', onClick: () => copyText(value, cap(copyLabel) + ' copied') }));
  }

  function logIcon(cat) {
    return { cookies: 'cookie', rules: 'rules', shopping: 'bag', games: 'game', phone: 'phone', email: 'mail' }[cat] || 'check';
  }

  function logRow(e) {
    return c.row({
      left: c.iconTile(logIcon(e.cat), { tone: 'green', size: 36 }),
      title: e.text,
      subtitle: NC.dom.fmtDate(e.at, 'day') + ' · ' + NC.dom.fmtDate(e.at, 'time'),
      className: 'rl-log-row',
    });
  }

  function tipCard() {
    return c.banner({
      icon: 'sparkle',
      tone: 'white',
      className: 'rl-tip',
      text: 'Short on time? "Use recommended rules" turns on our picks in one tap.',
      action: c.iconButton('x', {
        label: 'Hide this tip',
        onClick: () => R.update((r) => { r.tipDismissed = true; }),
      }),
    });
  }

  function editRules() {
    startDraft(currentValues(), 'steps', 'direct');
    NC.router.go('/rules/setup/1');
  }

  function useRecommended(entry) {
    startDraft(R.recommended(), 'recommended', entry);
    NC.router.go('/rules/review');
  }

  function rulesTab(params, query) {
    const r = R.get();
    if (!r) {
      return c.screen({ body: [c.title('Your privacy rules'), c.empty({ icon: 'rules', title: 'Log in to see your rules', text: 'Your rules are saved with your account.' })] });
    }
    if (query && query.added) {
      // same trick as receipts with ?q: use it, then drop it so a reload doesn't toast again.
      // force, because we might already be on /rules and go() would only refresh
      const rule = R.getCustom(query.added);
      highlight = rule ? rule.id : null;
      if (rule) tabToast = toast('New rule added for ' + rule.title.toLowerCase(), { tone: 'success' });
      NC.router.go('/rules', { replace: true, force: true, transition: 'fade' });
      return null;
    }
    // the "New" chip shows once, then clears
    r.custom.forEach((x) => { if (x.isNew) seenNew.add(x.id); });
    if (r.custom.some((x) => x.isNew)) R.update((x) => x.custom.forEach((cr) => { cr.isNew = false; }));

    const rows = CATEGORIES.map((cat) => catRow(cat, r))
      .concat(r.custom.map((rule) => customRow(rule, rule.id === highlight)));
    const body = [c.title('Your privacy rules')];
    if (!r.configured) {
      body.push(h('p.lead.rl-lead', 'Rules let NeedCheck answer for you, so it only interrupts when something is off.'));
      if (!r.tipDismissed) body.push(tipCard());
    }
    const parts = [statusCard(r), c.card(c.list(rows), { className: 'rl-list' })];

    if (!r.configured) {
      parts.push(c.button('Set up my rules', { onClick: () => NC.router.go('/rules/setup') }));
      parts.push(c.button('Use recommended rules', { variant: 'secondary', onClick: () => useRecommended('direct') }));
    } else {
      const m = r.masked && r.masked.email ? r.masked : R.masked();
      parts.push(c.button('Edit rules', { variant: 'secondary', onClick: editRules }));
      // one way on: the masked details page has the explainer and how it works
      parts.push(c.section('Your masked details', c.card([
        maskedLine('mail', 'Masked email', m.email, 'masked email'),
        maskedLine('phone', 'Masked number', m.phone, 'masked number'),
        h('div.rl-ph-foot',
          h('button.link', { type: 'button', onClick: () => NC.router.go('/rules/masked') }, 'See how masking works', NC.icon('chev', { size: 16 }))),
      ], { className: 'rl-ph' }), { className: 'rl-section' }));
      if (r.log.length) {
        const more = r.log.length > 3 ? h('button.link', { type: 'button', onClick: () => NC.router.go('/rules/log') }, 'See all') : null;
        parts.push(c.section('Rules in action', c.card(c.list(r.log.slice(0, 3).map(logRow)), { className: 'rl-log' }), { action: more, className: 'rl-section' }));
      }
    }
    body.push(h('div.stack.rl-stack', parts));
    return c.screen({ body: body, className: 'rl-screen' });
  }

  NC.router.add('/rules', { tab: 'rules', title: 'Rules', live: true, render: rulesTab });

  // setup intro
  NC.router.add('/rules/setup', {
    tab: null,
    title: 'Set up rules',
    render() {
      if (justSaved()) return leaveOldSetup();
      const d = readDraft();
      const resume = d && isDirty();
      const start = () => {
        if (readDraft()) {
          draft.entry = 'intro';
          draft.fromReview = false;
          writeDraft();
        } else {
          startDraft(currentValues(), 'steps', 'intro');
        }
        NC.router.go('/rules/setup/1');
      };
      return c.screen({
        nav: c.navBar({ title: 'Set up rules', back: leaveSetup }),
        className: 'rl-intro',
        body: [
          c.iconTile('rules', { tone: 'primary', shape: 'square', size: 56, className: 'rl-intro-mark' }),
          c.title("Let's set up your rules", { size: 'xl', as: 'h2' }),
          h('p.lead.rl-intro-lead', 'Three quick steps. NeedCheck uses your answers to handle pop-ups for you.'),
          resume ? c.banner({
            icon: 'undo',
            tone: 'peach',
            text: 'Your earlier choices are still here, so you can pick up where you left off.',
            action: h('button.link', { type: 'button', onClick: () => { clearDraft(); NC.router.refresh(); } }, 'Start over'),
            className: 'rl-resume',
          }) : null,
          h('ol.rl-steps', STEPS.map((s) => h('li.rl-step',
            h('span.rl-step-tile', c.iconTile(s.icon, { tone: 'cream', shape: 'square', size: 44 }), h('span.rl-step-n', String(s.n))),
            h('div.rl-step-text', h('p.rl-step-title', s.label), h('p.rl-step-line', s.line))))),
          h('p.rl-time', NC.icon('clock', { size: 18 }), 'About 1 minute. You can change anything later.'),
        ],
        footer: [
          c.button(resume ? 'Pick up where I left off' : 'Start', { onClick: start }),
          c.button('Use recommended rules', { variant: 'secondary', onClick: () => useRecommended('intro') }),
        ],
      });
    },
  });

  // phone back right after saving shouldnt drop people into an empty setup again
  function justSaved() {
    const r = R.get();
    return !readDraft() && !!(r && r.configured && r.lastSave && Date.now() - new Date(r.lastSave.at).getTime() < 120000);
  }

  // phone back into setup right after saving. going back we hop past all the old
  // setup pages to where setup started, otherwise we land on the rules tab. force, since that may be
  // the screen that's still up, and go() would only refresh it (and show the router's placeholder)
  function leaveOldSetup() {
    const i = idxNow();
    if (i != null && shownIdx != null && i < shownIdx) {
      for (let k = i - 1; k >= 0 && visited[k] !== undefined; k--) {
        if (SETUP_RE.test(visited[k]) || visited[k] === '/rules/saved') continue;
        // draw that screen now, then move history there quietly (same path, so the router won't redraw)
        NC.router.go(visitedFull[k] || visited[k], { replace: true, force: true, transition: 'back' });
        history.go(k - i);
        shownIdx = k;
        return null;
      }
    }
    NC.router.go('/rules', { replace: true, force: true, transition: 'fade' });
    return null;
  }

  function stepScreen(n) {
    const step = STEPS[n - 1];
    if (justSaved()) return leaveOldSetup();
    const d = ensureDraft();
    const v = d.values;
    const rows = [];
    const anyLocation = (vals) => Object.keys(vals.location).some((k) => vals.location[k]);
    const note = n === 3
      ? h('p.rl-note', { hidden: anyLocation(v) }, NC.icon('info', { size: 18 }), 'With none on, NeedCheck asks you each time an app wants your location.')
      : null;
    const set = (key, val) => {
      const cur = readDraft();
      if (!cur) return;
      writePath(cur.values, T[key].path, val);
      writeDraft();
      if (note) note.hidden = anyLocation(cur.values);
    };
    const cards = step.groups.map((keys, gi) => {
      const card = c.card(keys.map((key) => {
        const row = toggleRow(key, !!readPath(v, T[key].path), (val) => set(key, val), { pick: isPick(key), prefix: 'step' });
        rows.push({ key: key, row: row });
        return row;
      }), { className: 'rt-card' });
      // step 3's birthday card gets its own little heading
      const label = step.groupLabels && step.groupLabels[gi];
      return label ? [h('h3.label.rl-group-label', label), card] : card;
    });

    // no toast here, it would sit on top of the back and close buttons. the link itself says it worked
    const picksLabel = h('span', 'Use our picks for this step');
    const picksIcon = h('span.rl-picks-icon', NC.icon('sparkle', { size: 18 }));
    const said = h('p.sr-only', { 'aria-live': 'polite' });
    let picksTimer = null;
    const usePicks = () => {
      const rec = R.recommended();
      rows.forEach((x) => x.row.toggle.setOn(!!readPath(rec, T[x.key].path)));
      picksLabel.textContent = 'Our picks are on';
      picksIcon.replaceChildren(NC.icon('check', { size: 18, stroke: 2.6 }));
      said.textContent = 'Our picks are on for ' + step.label.toLowerCase() + '.';
      clearTimeout(picksTimer);
      picksTimer = setTimeout(() => {
        picksLabel.textContent = 'Use our picks for this step';
        picksIcon.replaceChildren(NC.icon('sparkle', { size: 18 }));
      }, 2500);
    };

    const skip = () => {
      const cur = readDraft();
      if (cur) {
        const f = R.fresh();
        rows.forEach((x) => writePath(cur.values, T[x.key].path, readPath(f, T[x.key].path)));
        writeDraft();
      }
      goNext();
    };

    const goNext = () => {
      const cur = readDraft();
      if (cur) {
        cur.via = 'steps';
        writeDraft();
      }
      NC.router.go(n < 3 ? '/rules/setup/' + (n + 1) : '/rules/review');
    };

    // "go back and edit" from the review opens step 1, so back from there returns to the review
    const back = () => {
      const cur = readDraft() || d;
      if (n > 1) backTo('/rules/setup/' + (n - 1));
      else if (cur.fromReview) backTo('/rules/review');
      else if (cur.entry === 'intro') backTo('/rules/setup');
      else leaveSetup();
    };

    const extra = [];
    if (n === 2) extra.push(maskedCard(h('button.link.rl-ph-link', { type: 'button', onClick: explainMasking }, NC.icon('info', { size: 18 }), 'What does masking mean?')));
    if (note) extra.push(note);

    // the bar's h1 gets the focus after each Next, so screen readers hear which step this is
    return c.screen({
      nav: c.navBar({ title: ['Set up rules', h('span.sr-only', ', step ' + n + ' of 3, ' + step.name)], back: back, right: closeButton() }),
      className: 'rl-stepscreen',
      body: [
        c.stepper({ step: n, total: 3, labels: STEP_NAMES }),
        c.title(step.question, { size: 'lg', className: 'rl-q' }),
        h('p.lead.rl-helper', step.helper),
        h('button.link.rl-picks', { type: 'button', onClick: usePicks }, picksIcon, picksLabel),
        said,
        h('div.stack', cards, extra),
        h('div.rl-skip', h('button.link', { type: 'button', onClick: skip }, 'Skip this step')),
      ],
      footer: c.button(step.next, { onClick: goNext }),
    });
  }

  [1, 2, 3].forEach((n) => {
    NC.router.add('/rules/setup/' + n, {
      tab: null,
      title: 'Set up rules, step ' + n + ' of 3',
      render: () => stepScreen(n),
    });
  });

  function saveRules(btn) {
    const d = readDraft();
    if (!d) {
      NC.router.go('/rules', { replace: true });
      return;
    }
    if (btn) btn.disabled = true;
    const v = clone(d.values);
    const at = iso();
    let first = true;
    R.update((r) => {
      first = !r.configured;
      r.cookies = v.cookies;
      r.contact = v.contact;
      r.location = v.location;
      r.hideBirthday = !!v.hideBirthday;
      r.configured = true;
      r.savedAt = at;
      r.paused = { cookies: false, phone: false, email: false, location: false, birthday: false };
      r.draft = null;
      r.tipDismissed = true;
      r.log.unshift({ at: at, text: first ? 'Rules saved' : 'Rules updated', cat: 'rules' });
    });
    draft = null;
    const handled = R.handleCookieBanners();
    R.update((r) => {
      r.lastSave = {
        at: at,
        first: first,
        handled: handled.map((q) => ({ appId: q.appId, allowed: q.decision.allowed, declined: q.decision.declined })),
      };
    });
    NC.router.go('/rules/saved', { replace: true });
  }

  NC.router.add('/rules/review', {
    tab: null,
    title: 'Review your rules',
    render() {
      if (justSaved()) return leaveOldSetup();
      const d = ensureDraft();
      const v = d.values;
      const lines = whatWeDo(v);
      const askMe = CATEGORIES.filter((cat) => !R.settingsOn(v, cat.key));
      const stepper = c.stepper({ step: 3, total: 3, labels: STEP_NAMES });
      const label = stepper.querySelector('.stepper-label');
      if (label) label.textContent = 'Almost done';
      const edit = () => {
        if (d.via === 'recommended') {
          d.fromReview = true;
          writeDraft();
          NC.router.go('/rules/setup/1');
        } else backTo('/rules/setup/3');
      };
      const ours = d.via === 'recommended' && JSON.stringify(v) === JSON.stringify(R.recommended());
      // the back arrow goes where they came from, like the phone back. "Go back and edit" opens the steps
      const back = () => {
        if (d.via !== 'recommended') backTo('/rules/setup/3');
        else if (d.entry === 'intro') backTo('/rules/setup');
        else leaveSetup();
      };
      const check = () => c.iconTile('check', { tone: 'green', size: 30 });
      const saveBtn = c.button('Save my rules', { onClick: () => saveRules(saveBtn) });
      return c.screen({
        nav: c.navBar({ title: ['Set up rules', h('span.sr-only', ', review')], back: back, right: closeButton() }),
        className: 'rl-review',
        body: [
          stepper,
          c.title("Here's what NeedCheck will do for you", { size: 'lg', className: 'rl-q' }),
          ours ? h('p.lead.rl-helper', 'These are our picks. Save them, or go back and change any of them.') : null,
          lines.length
            ? c.card(c.list(lines.map((t) => c.row({ left: check(), title: keepHyphens(t), className: 'rl-do' }))), { className: 'rl-do-card' })
            : c.card(h('p.card-text', "You haven't turned anything on, so NeedCheck will keep asking you about everything."), { tone: 'cream' }),
          askMe.length && lines.length ? c.section('NeedCheck will still ask you about', c.card(c.list(askMe.map((cat) => c.row({
            left: NC.icon(cat.icon, { size: 22 }), title: cat.title, right: c.chip('Ask me', { tone: 'cream' }), className: 'rl-row',
          }))), { className: 'rl-list' }), { className: 'rl-section' }) : null,
          h('p.rl-later', 'You can change any of these later in Rules.'),
        ],
        footer: [saveBtn, c.button('Go back and edit', { variant: 'ghost', onClick: edit })],
      });
    },
  });

  // the new "your rules are on" screen (dp3 problem 7: people didn't notice the save)
  NC.router.add('/rules/saved', {
    tab: null,
    title: 'Your rules are on',
    render() {
      const r = R.get();
      if (!r || !r.configured) {
        NC.router.go('/rules', { replace: true, force: true });
        return null;
      }
      const lines = nowAutomatic(r);
      const handled = (r.lastSave && r.lastSave.handled) || [];
      const anyOn = lines.length > 0;
      const handledBanner = handled.length ? c.banner({
        icon: 'checkCircle',
        tone: 'green',
        title: 'Already handled: ' + NC.dom.listText(handled.map((x) => appName(x.appId) + "'s")) + ' cookie ' + (handled.length > 1 ? 'banners' : 'banner'),
        text: handledText(handled),
        className: 'rl-handled',
      }) : null;
      return c.screen({
        className: 'rl-saved',
        body: [
          h('div.rl-done-mark', NC.icon('check', { size: 46, stroke: 2.6 })),
          c.title(anyOn ? 'Your rules are on' : 'Your rules are saved', { size: 'xl', as: 'h1', className: 'rl-done-title' }),
          h('p.lead.rl-done-lead', anyOn
            ? 'From now on NeedCheck answers for you and only asks when something is off.'
            : 'Nothing is switched on yet, so NeedCheck will keep asking you. You can turn rules on in the Rules tab.'),
          handledBanner,
          anyOn ? c.section('Now automatic', c.card(h('ul.rl-auto', lines.map((x) => h('li',
            h('span.rl-auto-icon', NC.icon(x.icon, { size: 20 })), h('span', keepHyphens(x.text)),
            h('span.rl-auto-check', NC.icon('check', { size: 18, stroke: 2.6 }))))), { className: 'rl-auto-card' }), { className: 'rl-section' }) : null,
        ],
        footer: [
          c.button('Back to home', { onClick: () => popTo('/home', 'fade') }),
          c.button('See my rules', {
            variant: 'secondary',
            onClick: () => {
              // the old scroll spot belongs to the empty screen, so start at the top
              topNext = true;
              popTo('/rules', 'fade');
            },
          }),
        ],
      });
    },
  });

  function handledText(handled) {
    const declined = [];
    const kept = [];
    handled.forEach((x) => {
      (x.declined || []).forEach((t) => { if (declined.indexOf(t) < 0) declined.push(t); });
      (x.allowed || []).forEach((t) => { if (kept.indexOf(t) < 0) kept.push(t); });
    });
    const words = (list) => NC.dom.listText(list.map((t) => typeLabel(t).toLowerCase().replace(/ cookies$/, ''))) + ' cookies';
    let s = declined.length ? 'We declined ' + words(declined) : 'We answered it for you';
    if (kept.length) s += ' and kept the ' + words(kept).replace(/^login cookies$/, 'login ones');
    return s + '.';
  }

  // detail page for one rule (dp4 fix h6: saved rules were read only before)
  // a paused rule shows its settings as off and locked, so the page never says off and on at once
  function settingRows(cat, r, paused) {
    const v = R.values(r);
    return cat.toggles.map((key) => toggleRow(key, !paused && !!readPath(v, T[key].path), (val) => deferred('tg-' + key, () => {
      if (!!readPath(R.values(R.get()), T[key].path) === val) return;
      R.update((x) => writePath(x, T[key].path, val));
      const after = R.get();
      let msg = 'Saved';
      let note = 'Saved';
      if (!R.settingsOn(after, cat.key)) msg = 'Saved. With all of these off, NeedCheck will ask you about ' + cat.title.toLowerCase() + '.';
      else if (cat.key === 'cookies' && val) {
        const done = R.handleCookieBanners();
        if (done.length) {
          msg = 'Saved. Answered ' + NC.dom.plural(done.length, 'cookie banner') + ' for you.';
          note = 'Saved · answered ' + NC.dom.plural(done.length, 'banner');
        }
      }
      flash = { key: cat.key, at: Date.now(), text: note };
      say(msg);
    }), { pick: isPick(key), disabled: paused, prefix: 'cat' }));
  }

  function categoryScreen(params) {
    const key = params.key;
    const r = R.get();
    if (!r) {
      NC.router.go('/rules', { replace: true, force: true });
      return null;
    }
    const cat = CAT[key];
    if (!cat) {
      const rule = r.custom.find((x) => x.id === key);
      if (rule) return customScreen(rule);
      NC.router.go('/rules', { replace: true, force: true });
      return null;
    }
    if (!r.configured) {
      NC.router.go('/rules/setup', { replace: true, force: true });
      return null;
    }
    const on = R.isOn(r, key);
    const paused = !!r.paused[key];
    // phone and email have one setting, so the rule switch is that setting. no second switch to fight with
    const single = cat.toggles.length === 1;
    const v = R.values(r);
    const m = R.masked();
    const master = c.toggle({
      id: 'cat-master',
      checked: on,
      label: cat.title + ' rule',
      onChange: (val) => deferred('cat-' + key, () => {
        if (R.isOn(R.get(), key) !== val) setCategory(key, val, true);
      }),
    });
    const recent = r.log.filter((e) => e.cat === key).slice(0, 3);
    const standIn = [
      key === 'phone' ? maskedLine('phone', 'Masked number', m.phone, 'masked number') : maskedLine('mail', 'Masked email', m.email, 'masked email'),
      h('div.rl-ph-foot', h('button.link', { type: 'button', onClick: explainMasking }, NC.icon('info', { size: 18 }), 'What does masking mean?')),
    ];
    return c.screen({
      // the big heading below names the page, so the bar only carries Back
      nav: c.navBar({ back: '/rules' }),
      className: 'rl-detail',
      body: [
        h('div.rl-detail-head', c.iconTile(cat.icon, { tone: on ? 'primary' : 'cream', shape: 'square', size: 48 }),
          c.title(cat.title, { size: 'lg', as: 'h1' })),
        h('p.lead.rl-detail-lead', cat.about),
        c.card(h('div.rl-master',
          h('div.rl-master-text', h('p.card-title', on ? 'Rule is on' : 'Rule is off'),
            h('p.card-text', on ? summary(key, v) : 'NeedCheck asks you each time')),
          master), { tone: on ? 'green' : 'white', className: 'rl-master-card' }),
        single ? null : c.section('Settings', [
          c.card(settingRows(cat, r, paused), { className: 'rt-card' }),
          paused ? h('p.rl-note', NC.icon('info', { size: 18 }), 'Turn the rule on to change these.') : null,
        ], { className: 'rl-section', action: savedNote(key) }),
        single ? c.section('Your masked ' + (key === 'phone' ? 'number' : 'email'), c.card(standIn, { className: 'rl-ph' }), { className: 'rl-section' }) : null,
        recent.length ? c.section('Recently', c.card(c.list(recent.map(logRow)), { className: 'rl-log' }), { className: 'rl-section' }) : null,
        h('div.rl-detail-foot', on
          ? c.button('Turn off this rule', { variant: 'danger', onClick: () => setCategory(key, false, true) })
          : c.button('Turn on this rule', { variant: 'secondary', onClick: () => setCategory(key, true, true) })),
      ],
    });
  }

  function customScreen(rule) {
    const added = NC.dom.fmtDate(rule.createdAt, 'long');
    const master = c.toggle({
      id: 'cat-master',
      checked: !!rule.on,
      label: rule.title + ' rule',
      onChange: (val) => deferred('custom-' + rule.id, () => {
        const cur = R.getCustom(rule.id);
        if (!cur || !!cur.on === val) return;
        R.setCustomOn(rule.id, val);
        say(rule.title + (val ? ' rule is on' : ' rule is off'));
      }),
    });
    const remove = () => {
      ask({
        title: 'Remove this rule?',
        message: 'NeedCheck will go back to asking you about ' + rule.title.toLowerCase() + '.',
        confirmLabel: 'Remove',
        danger: true,
        icon: 'trash',
      }).then((ok) => {
        if (!ok) return;
        const removed = R.removeCustom(rule.id);
        popTo('/rules');
        tabToast = toast('Rule removed', { tone: 'info', action: { label: 'Undo', onClick: () => R.restoreCustom(removed) } });
      });
    };
    return c.screen({
      nav: c.navBar({ back: '/rules' }),
      className: 'rl-detail',
      body: [
        h('div.rl-detail-head', c.iconTile(rule.icon || 'rules', { tone: rule.on ? 'primary' : 'cream', shape: 'square', size: 48 }),
          c.title(rule.title, { size: 'lg', as: 'h1' })),
        h('p.lead.rl-detail-lead', rule.text || rule.desc || 'A rule you added.'),
        c.card(h('div.rl-master',
          h('div.rl-master-text', h('p.card-title', rule.on ? 'Rule is on' : 'Rule is off'),
            h('p.card-text', rule.on ? rule.desc || 'NeedCheck answers for you' : 'NeedCheck asks you each time')),
          master), { tone: rule.on ? 'green' : 'white', className: 'rl-master-card' }),
        h('p.rl-added', NC.icon('calendar', { size: 18 }), 'Added ' + added),
        h('div.rl-detail-foot', c.button('Remove this rule', { variant: 'danger', icon: 'trash', onClick: remove })),
      ],
    });
  }

  NC.router.add('/rules/category/:key', {
    tab: 'rules',
    live: true,
    title: (p) => (CAT[p.key] ? CAT[p.key].title : 'Rule'),
    render: categoryScreen,
  });

  NC.router.add('/rules/masked', {
    tab: 'rules',
    title: 'Your masked details',
    live: true,
    render() {
      const r = R.get();
      const m = R.masked();
      const v = R.values(r);
      const using = (on, what) => (on && r && r.configured ? 'In use for low-stakes sign-ups' : 'Not in use yet. Turn on "Mask my ' + what + '" in Rules.');
      return c.screen({
        nav: c.navBar({ back: '/rules' }),
        className: 'rl-masked',
        body: [
          c.title('Your masked details', { size: 'lg', as: 'h1' }),
          h('p.lead.rl-detail-lead', "Sites that don't need your real email or number get these instead. Anything they send still reaches you."),
          c.card([
            maskedLine('mail', 'Masked email', m.email, 'masked email'),
            h('p.rl-ph-status', using(v.contact.maskEmail && !(r.paused && r.paused.email), 'email')),
            maskedLine('phone', 'Masked number', m.phone, 'masked number'),
            h('p.rl-ph-status', using(v.contact.maskPhone && !(r.paused && r.paused.phone), 'phone number')),
          ], { className: 'rl-ph' }),
          c.section('How it works', c.card(h('ol.rl-how',
            h('li', h('span.rl-how-n', '1'), h('span', 'A site asks for your email on a sign-up form.')),
            h('li', h('span.rl-how-n', '2'), h('span', 'NeedCheck fills in ' + m.email + ' instead.')),
            h('li', h('span.rl-how-n', '3'), h('span', 'Their emails are passed on to your real inbox. They never see your real address.'))),
          { tone: 'cream' }), { className: 'rl-section' }),
          h('div.rl-detail-foot', c.button('What does masking mean?', { variant: 'secondary', icon: 'info', onClick: explainMasking })),
        ],
      });
    },
  });

  NC.router.add('/rules/log', {
    tab: 'rules',
    title: 'Rules in action',
    live: true,
    render() {
      const r = R.get();
      const log = (r && r.log) || [];
      const groups = [];
      log.forEach((e) => {
        const day = NC.dom.fmtDate(e.at, 'day');
        let g = groups[groups.length - 1];
        if (!g || g.day !== day) groups.push((g = { day: day, items: [] }));
        g.items.push(e);
      });
      return c.screen({
        nav: c.navBar({ title: 'Rules in action', back: '/rules' }),
        className: 'rl-logpage',
        body: groups.length
          ? [h('p.lead.rl-detail-lead', 'Everything your rules did for you, newest first.')].concat(groups.map((g) => c.section(g.day, c.card(c.list(g.items.map(logRow)), { className: 'rl-log' }), { className: 'rl-section' })))
          : c.empty({ icon: 'rules', title: 'Nothing yet', text: 'When your rules answer a pop-up for you, it shows up here.' }),
      });
    },
  });

  // remember where people were before setup, and keep the in-app history map current
  NC.router.onChange((cur) => {
    if (!cur) return;
    const i = idxNow();
    shownIdx = i;
    if (i != null) {
      Object.keys(visited).forEach((k) => {
        if (Number(k) > i) {
          delete visited[k];
          delete visitedFull[k];
        }
      });
      visited[i] = cur.path;
      visitedFull[i] = cur.full;
    }
    if (!SETUP_RE.test(cur.path) && cur.path !== '/rules/saved') lastOutside = { path: cur.path };
    if (cur.path !== '/rules') {
      seenNew.clear();
      highlight = null;
      if (tabToast) tabToast.close();
      tabToast = null;
    } else if (topNext) {
      topNext = false;
      const body = document.querySelector('#view .screen:last-child .screen-body');
      if (body) body.scrollTop = 0;
    }
  });

  // home: the light green "let NeedCheck answer for you" card sits right under the first request (dp3 problem 10)
  function setupCard() {
    return c.card([
      h('div.rl-home-head', c.iconTile('rules', { tone: 'white-primary', shape: 'square', size: 40 }),
        h('h3.card-title', 'Let NeedCheck answer for you')),
      h('p.card-text.rl-home-text', "Set your preferences once. We'll answer cookie banners and sign-ups for you."),
      c.button('Set up my rules', { onClick: () => NC.router.go('/rules/setup') }),
    ], { tone: 'primary-soft', className: 'rl-home-card' });
  }

  function answeredCard(list) {
    const names = [];
    list.forEach((q) => {
      const n = appName(q.appId);
      if (names.indexOf(n) < 0) names.push(n);
    });
    return c.card(c.row({
      left: c.iconTile('shield', { tone: 'white-green', size: 44 }),
      title: 'Your rules answered ' + NC.dom.plural(list.length, 'cookie banner'),
      subtitle: NC.dom.listText(names.slice(0, 3)) + ' · nothing for you to do',
      chevron: true,
      onClick: () => NC.router.go('/rules'),
    }), { tone: 'green', pad: false, className: 'rl-home-answered' });
  }

  NC.hooks.add('home-cards', () => {
    const r = R.get();
    if (!r) return null;
    if (!r.configured) return { id: 'rules-setup', priority: 15, el: setupCard() };
    // only this week's, so the card doesn't hang around forever
    const recent = R.autoAnswered().filter((q) => q.kind === 'cookies' && NC.dom.daysBetween(q.decision.at, new Date()) < 7);
    return recent.length ? { id: 'rules-answered', priority: 40, el: answeredCard(recent) } : null;
  });

  // same one week window as bianca's numbers. both count asks: everything a banner asked for, and what we said no to
  NC.hooks.add('home-stats', () => {
    const weekAgo = Date.now() - 7 * 86400000;
    const auto = R.autoAnswered().filter((q) => new Date(q.decision.at).getTime() >= weekAgo);
    if (!auto.length) return null;
    return {
      checked: auto.reduce((n, q) => n + (q.asks || []).length, 0),
      declined: auto.reduce((n, q) => n + ((q.decision && q.decision.declined) || []).length, 0),
    };
  });

  // a dot on the tab until rules are set up, or when a new rule was added somewhere else.
  // true means a plain dot, so it never reads as a count of new requests
  NC.hooks.add('tab-badge', (tab) => {
    if (tab !== 'rules') return null;
    const r = R.get();
    if (!r) return null;
    return !r.configured || r.custom.some((x) => x.isNew) ? true : null;
  });

  function forget() {
    draft = null;
    seenNew.clear();
    highlight = null;
    flash = null;
  }

  NC.hooks.add('data-reset', forget);
  // someone else logging in on this phone must not pick up the last person's half-done setup
  if (NC.store && NC.store.on) {
    NC.store.on((name) => {
      if (name === '*') forget();
    });
  }
})();
