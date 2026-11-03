// rules data for task 2
(function () {
  const NC = (window.NC = window.NC || {});

  const CATS = ['cookies', 'phone', 'email', 'location', 'birthday'];
  const LOG_MAX = 60;

  function clone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // fresh = nothing set up yet. keeping login cookies is the only thing on
  function fresh() {
    return {
      cookies: { declineAds: false, declineAnalytics: false, keepLogin: true, flagSneaky: false },
      contact: { maskEmail: false, maskPhone: false, skipOptional: false },
      location: { maps: false, food: false, games: false, shopping: false, social: false },
      hideBirthday: false,
    };
  }

  function recommended() {
    return {
      cookies: { declineAds: true, declineAnalytics: true, keepLogin: true, flagSneaky: true },
      contact: { maskEmail: true, maskPhone: true, skipOptional: true },
      location: { maps: true, food: true, games: false, shopping: false, social: false },
      hideBirthday: true,
    };
  }

  function noPause() {
    return { cookies: false, phone: false, email: false, location: false, birthday: false };
  }

  // stand in details come from the name so they stay the same every visit.
  function maskedFor(user) {
    const name = String((user && user.name) || 'NeedCheck user').trim().toLowerCase();
    const words = name.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    let n = 0;
    for (const ch of name) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    const first = words[0] || 'me';
    const last = words.length > 1 ? words[words.length - 1][0] : '';
    const digit = (n + 6) % 10;
    const tail = String(((n >>> 4) + 54) % 100).padStart(2, '0');
    return {
      email: first + '.' + last + digit + '@relay.needcheck.app',
      phone: '(469) 555-01' + tail,
    };
  }

  function seed(user) {
    return Object.assign(fresh(), {
      configured: false,
      savedAt: null,
      paused: noPause(),
      custom: [],
      masked: maskedFor(user),
      log: [],
      draft: null,
      lastSave: null,
      tipDismissed: false,
    });
  }

  if (NC.store) NC.store.seed('rules', seed);

  function get() {
    if (!NC.store) return null;
    const r = NC.store.get('rules');
    return r && typeof r === 'object' ? r : null;
  }

  function update(fn) {
    if (!NC.store) return undefined;
    return NC.store.update('rules', (r) => {
      if (!r) return undefined;
      // older saves might miss a field, so fill those in before anyone touches them
      r.paused = Object.assign(noPause(), r.paused || {});
      r.custom = Array.isArray(r.custom) ? r.custom : [];
      r.log = Array.isArray(r.log) ? r.log : [];
      fn(r);
      if (r.log.length > LOG_MAX) r.log.length = LOG_MAX;
      return r;
    });
  }

  // just the settings part, the same shape as fresh() and recommended()
  function values(r) {
    const base = fresh();
    if (!r) return base;
    return {
      cookies: Object.assign(base.cookies, r.cookies || {}),
      contact: Object.assign(base.contact, r.contact || {}),
      location: Object.assign(base.location, r.location || {}),
      hideBirthday: !!r.hideBirthday,
    };
  }

  // does this category have anything switched on (ignoring pause)
  function settingsOn(v, cat) {
    const x = values(v);
    switch (cat) {
      case 'cookies': return !!(x.cookies.declineAds || x.cookies.declineAnalytics || x.cookies.flagSneaky);
      case 'phone': return !!x.contact.maskPhone;
      case 'email': return !!x.contact.maskEmail;
      case 'location': return Object.keys(x.location).some((k) => x.location[k]);
      case 'birthday': return !!(x.hideBirthday || x.contact.skipOptional);
      default: return false;
    }
  }

  function isOn(r, cat) {
    return !!r && !!r.configured && !(r.paused && r.paused[cat]) && settingsOn(r, cat);
  }

  // copies our picks for one category into a values object 
  function applyPicks(v, cat) {
    const rec = recommended();
    if (cat === 'cookies') v.cookies = rec.cookies;
    if (cat === 'phone') v.contact = Object.assign({}, v.contact, { maskPhone: true });
    if (cat === 'email') v.contact = Object.assign({}, v.contact, { maskEmail: true });
    if (cat === 'location') v.location = rec.location;
    if (cat === 'birthday') {
      v.hideBirthday = true;
      v.contact = Object.assign({}, v.contact, { skipOptional: true });
    }
    return v;
  }

  function isConfigured() {
    const r = get();
    return !!(r && r.configured);
  }

  function masked() {
    const r = get();
    if (r && r.masked && r.masked.email) return clone(r.masked);
    return maskedFor(NC.store && NC.store.currentUser ? NC.store.currentUser() : null);
  }

  function addLog(text, cat) {
    update((r) => {
      r.log.unshift({ at: nowIso(), text: text, cat: cat || 'rules' });
    });
  }

  // no duplicates: adding a rule that's already there just switches it back on
  function addCustom(rule) {
    if (!rule || !rule.id) return null;
    let out = null;
    update((r) => {
      const have = r.custom.find((x) => x.id === rule.id);
      if (have) {
        have.on = true;
        out = clone(have);
        return;
      }
      const item = {
        id: String(rule.id),
        category: rule.category || 'other',
        icon: rule.icon && NC.icon && NC.icon.has(rule.icon) ? rule.icon : 'rules',
        title: rule.title || 'Custom rule',
        desc: rule.desc || '',
        text: rule.text || '',
        on: rule.on !== false,
        isNew: true,
        createdAt: nowIso(),
      };
      r.custom.push(item);
      r.log.unshift({ at: item.createdAt, text: 'New rule added: ' + item.title, cat: item.category });
      out = clone(item);
    });
    return out;
  }

  function hasCustom(id) {
    const r = get();
    return !!(r && Array.isArray(r.custom) && r.custom.some((x) => x.id === id));
  }

  function getCustom(id) {
    const r = get();
    return (r && Array.isArray(r.custom) && clone(r.custom.find((x) => x.id === id))) || null;
  }

  function setCustomOn(id, on) {
    update((r) => {
      const x = r.custom.find((c) => c.id === id);
      if (x) x.on = !!on;
    });
  }

  // returns what was removed and where, so undo can put it back in the same spot
  function removeCustom(id) {
    let removed = null;
    update((r) => {
      const at = r.custom.findIndex((c) => c.id === id);
      if (at < 0) return;
      removed = { rule: r.custom[at], index: at };
      r.custom.splice(at, 1);
    });
    return removed;
  }

  function restoreCustom(removed) {
    if (!removed || !removed.rule) return;
    update((r) => {
      if (r.custom.some((c) => c.id === removed.rule.id)) return;
      r.custom.splice(Math.min(removed.index, r.custom.length), 0, removed.rule);
    });
  }

  function cookieAllowed(ask, ck) {
    if (ask.type === 'adCookies') return !ck.declineAds;
    if (ask.type === 'analyticsCookies') return !ck.declineAnalytics;
    if (ask.type === 'loginCookies') return !!ck.keepLogin;
    return ask.verdict === 'needed';
  }

  function lower(type) {
    const t = NC.dataType ? NC.dataType(type) : { label: type };
    return String(t.label || type).toLowerCase();
  }

  function appName(id) {
    return NC.app ? NC.app(id).name : id;
  }

  // answers every cookie banner still waiting in the requests slice
  // using the cookie rules, returns copies of the requests it answered
  function handleCookieBanners() {
    const r = get();
    if (!r || !isOn(r, 'cookies') || !NC.store || !NC.store.has('requests')) return [];
    const ck = values(r).cookies;
    if (!ck.declineAds && !ck.declineAnalytics) return [];
    const at = nowIso();
    const handled = [];
    NC.store.update('requests', (s) => {
      if (!s || !Array.isArray(s.items)) return undefined;
      s.items.forEach((req) => {
        if (!req || req.status !== 'pending' || req.kind !== 'cookies') return;
        const allowed = [];
        const declined = [];
        (req.asks || []).forEach((a) => (cookieAllowed(a, ck) ? allowed : declined).push(a.type));
        req.status = 'auto';
        req.isNew = false;
        req.decision = { at: at, mode: 'rules', allowed: allowed, declined: declined };
        handled.push(clone(req));
      });
      return s;
    });
    if (!handled.length) return handled;

    handled.forEach((req) => {
      if (NC.receipts && typeof NC.receipts.recordDecision === 'function') {
        try {
          NC.receipts.recordDecision(req);
        } catch (e) {
          console.error('could not save the receipt for ' + req.appId, e);
        }
      }
    });
    // newest first in the log, so write them oldest to newest
    update((x) => {
      handled.forEach((req) => {
        const name = appName(req.appId);
        req.decision.declined.forEach((t) => x.log.unshift({ at: at, text: 'Declined ' + lower(t) + ' on ' + name, cat: 'cookies', appId: req.appId }));
        req.decision.allowed.forEach((t) => x.log.unshift({ at: at, text: (t === 'loginCookies' ? 'Kept ' : 'Allowed ') + lower(t) + ' on ' + name, cat: 'cookies', appId: req.appId }));
      });
    });
    return handled;
  }

  // requests our rules answered, for the home numbers and the "your rules answered" card
  function autoAnswered() {
    if (!NC.store || !NC.store.has('requests')) return [];
    const s = NC.store.get('requests');
    return s && Array.isArray(s.items) ? s.items.filter((q) => q && q.status === 'auto' && q.decision) : [];
  }

  NC.rules = {
    CATS: CATS,
    isConfigured: isConfigured,
    get: get,
    update: update,
    values: values,
    fresh: fresh,
    recommended: recommended,
    settingsOn: settingsOn,
    isOn: isOn,
    applyPicks: applyPicks,
    masked: masked,
    maskedFor: maskedFor,
    log: addLog,
    addCustom: addCustom,
    hasCustom: hasCustom,
    getCustom: getCustom,
    setCustomOn: setCustomOn,
    removeCustom: removeCustom,
    restoreCustom: restoreCustom,
    handleCookieBanners: handleCookieBanners,
    autoAnswered: autoAnswered,
  };

  // account made before this file existed dont have stand-in details yet
  if (NC.hooks) {
    NC.hooks.add('after-login', (user) => {
      const r = get();
      if (r && (!r.masked || !r.masked.email)) update((x) => { x.masked = maskedFor(user); });
    });
  }
})();
