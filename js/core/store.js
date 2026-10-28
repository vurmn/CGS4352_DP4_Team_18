// saved data for needcheck: accounts, the logged in session, per-user slices and device settings.
// everything goes through localStorage, with a plain memory copy when the browser blocks storage.
(function () {
  const NC = (window.NC = window.NC || {});

  const VERSION = 1;
  const MIN_PASSWORD = 8;
  const KEYS = {
    users: 'needcheck:users',
    session: 'needcheck:session',
    settings: 'needcheck:settings',
    data: (id) => 'needcheck:data:' + id,
  };
  const DEFAULT_SETTINGS = { textSize: 'normal', reduceMotion: false, haptics: true };

  // wraps local/session storage. reads and writes also land in `mem`, so if the
  // browser says no (private mode, blocked cookies, full quota) the app keeps working for this visit
  function box(kind) {
    const mem = {};
    function real() {
      try {
        return window[kind] || null;
      } catch (e) {
        return null;
      }
    }
    return {
      get(key) {
        if (Object.prototype.hasOwnProperty.call(mem, key)) return mem[key];
        let v = null;
        try {
          const s = real();
          if (s) v = s.getItem(key);
        } catch (e) {
          v = null;
        }
        mem[key] = v;
        return v;
      },
      set(key, value) {
        mem[key] = value;
        try {
          const s = real();
          if (s) s.setItem(key, value);
        } catch (e) {
          // fine, the memory copy covers us until the tab closes
        }
      },
      remove(key) {
        mem[key] = null;
        try {
          const s = real();
          if (s) s.removeItem(key);
        } catch (e) {
          // same as above
        }
      },
      forget(key) {
        if (key == null) Object.keys(mem).forEach((k) => delete mem[k]);
        else delete mem[key];
      },
    };
  }

  const local = box('localStorage');
  const sess = box('sessionStorage');

  function readJSON(store, key) {
    const raw = store.get(key);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw);
      // anything saved by an older shape of the app gets dropped instead of half working
      if (!v || v.v !== VERSION) {
        store.remove(key);
        return null;
      }
      return v;
    } catch (e) {
      store.remove(key);
      return null;
    }
  }

  function writeJSON(store, key, obj) {
    store.set(key, JSON.stringify(Object.assign({ v: VERSION }, obj)));
  }

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function friendly(message, field) {
    const err = new Error(message);
    if (field) err.field = field;
    return err;
  }

  // listeners get the slice name, or '*' when everything changed (log in, log out, reset),
  // 'profile' after a name/email edit and 'settings' after a settings change
  const listeners = [];
  function emit(name) {
    listeners.slice().forEach((fn) => {
      try {
        fn(name);
      } catch (e) {
        console.error('store listener failed', e);
      }
    });
  }

  function runHook(name, arg) {
    if (NC.hooks && NC.hooks.collect) NC.hooks.collect(name, arg);
  }

  // passwords

  // we only keep a salted hash, this is a class prototype not a bank.
  // fnv-1a run a few hundred times, just so the raw password never sits in storage
  function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function hashPassword(password, salt) {
    let h = fnv(salt + ':' + password);
    for (let i = 0; i < 400; i++) h = fnv(h + salt + password);
    return h + fnv(password + h + salt);
  }

  function randomId(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    let bytes = null;
    try {
      bytes = window.crypto && window.crypto.getRandomValues(new Uint8Array(len));
    } catch (e) {
      bytes = null;
    }
    for (let i = 0; i < len; i++) {
      const n = bytes ? bytes[i] : Math.floor(Math.random() * 256);
      out += chars[n % chars.length];
    }
    return out;
  }

  function normEmail(email) {
    return String(email == null ? '' : email).trim().toLowerCase();
  }

  function isEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(email));
  }

  function checkEmail(email) {
    if (!email) throw friendly('Enter your email address.', 'email');
    if (!isEmail(email)) throw friendly("That doesn't look like an email address. Check it and try again.", 'email');
  }

  // users

  let usersCache = null;

  function makeUser(fields, password) {
    const salt = randomId(12);
    return {
      id: fields.id || 'u-' + randomId(10),
      name: String(fields.name || '').trim(),
      email: normEmail(fields.email),
      createdAt: fields.createdAt || new Date().toISOString(),
      salt,
      hash: hashPassword(password, salt),
    };
  }

  // the demo account comes from js/data/users.js, which loads after this file,
  // so we check for it whenever the list is read instead of once at startup
  function addSeedUsers(list) {
    const seeds = Array.isArray(NC.seedUsers) ? NC.seedUsers : [];
    let added = false;
    seeds.forEach((s) => {
      if (!s || !s.email || !s.password) return;
      const email = normEmail(s.email);
      if (list.some((u) => u.id === s.id || u.email === email)) return;
      list.push(makeUser(s, s.password));
      added = true;
    });
    return added;
  }

  function users() {
    if (!usersCache) {
      const saved = readJSON(local, KEYS.users);
      usersCache = saved && Array.isArray(saved.users) ? saved.users : [];
    }
    if (addSeedUsers(usersCache)) saveUsers();
    return usersCache;
  }

  function saveUsers() {
    writeJSON(local, KEYS.users, { users: usersCache || [] });
  }

  function findByEmail(email) {
    const e = normEmail(email);
    return users().find((u) => u.email === e) || null;
  }

  function publicUser(u) {
    return u ? { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt } : null;
  }

  // session

  function readSession() {
    return readJSON(sess, KEYS.session) || readJSON(local, KEYS.session);
  }

  function clearSession() {
    sess.remove(KEYS.session);
    local.remove(KEYS.session);
  }

  function startSession(user, remember) {
    clearSession();
    writeJSON(remember === false ? sess : local, KEYS.session, { userId: user.id, at: new Date().toISOString() });
    dataCache = null;
  }

  // who this tab last saw, so a change from another tab can tell if the person switched
  let lastUserId = null;

  function me() {
    const s = readSession();
    let u = s && s.userId ? users().find((x) => x.id === s.userId) : null;
    if (s && s.userId && !u) {
      // the account is gone (deleted in another tab maybe), so drop the stale session
      clearSession();
      u = null;
    }
    lastUserId = u ? u.id : null;
    return u || null;
  }

  // per-user slices

  const seeds = {};
  const order = [];
  let dataCache = null;

  function loadData(user) {
    if (dataCache && dataCache.userId === user.id) return dataCache.data;
    const saved = readJSON(local, KEYS.data(user.id));
    const data = saved && saved.slices && typeof saved.slices === 'object' ? saved : { slices: {} };
    dataCache = { userId: user.id, data };
    return data;
  }

  function saveData(user) {
    const data = loadData(user);
    data.savedAt = new Date().toISOString();
    writeJSON(local, KEYS.data(user.id), { slices: data.slices, savedAt: data.savedAt });
  }

  function seedSlice(name, user) {
    try {
      return clone(seeds[name](publicUser(user)));
    } catch (e) {
      console.error('could not seed "' + name + '"', e);
      return undefined;
    }
  }

  function raw(name, user) {
    const data = loadData(user);
    if (data.slices[name] !== undefined) return data.slices[name];
    if (!seeds[name]) return undefined;
    // lazy seeding: a slice registered after this user already had data still gets filled in
    const fresh = seedSlice(name, user);
    if (fresh === undefined) return undefined;
    data.slices[name] = fresh;
    saveData(user);
    return fresh;
  }

  // get() hands out a copy, so a value saved for undo can't change under you.
  // changes only stick through update() or set()
  function get(name) {
    const user = me();
    return user ? clone(raw(name, user)) : undefined;
  }

  function update(name, fn) {
    const user = me();
    if (!user) return undefined;
    const value = clone(raw(name, user));
    const next = fn(value);
    const result = next !== undefined ? next : value;
    if (result === undefined) return undefined;
    loadData(user).slices[name] = clone(result);
    saveData(user);
    emit(name);
    return clone(result);
  }

  function set(name, value) {
    const user = me();
    if (!user) return undefined;
    // copy it so a shared seed object can't get changed behind our back
    loadData(user).slices[name] = clone(value);
    saveData(user);
    emit(name);
    return clone(value);
  }

  function resetData() {
    const user = me();
    if (!user) return;
    const data = loadData(user);
    data.slices = {};
    order.forEach((name) => {
      const fresh = seedSlice(name, user);
      if (fresh !== undefined) data.slices[name] = fresh;
    });
    saveData(user);
    // hooks go first so features can clear their in-memory drafts before screens redraw
    runHook('data-reset');
    emit('*');
  }

  // accounts

  function signUp(fields) {
    const f = fields || {};
    const name = String(f.name || '').trim();
    const email = normEmail(f.email);
    const password = String(f.password || '');
    if (!name) throw friendly('Enter your name so we know what to call you.', 'name');
    checkEmail(email);
    if (password.length < MIN_PASSWORD) throw friendly('Your password needs at least 8 characters.', 'password');
    if (findByEmail(email)) throw friendly('That email already has an account. Try logging in.', 'email');
    const user = makeUser({ name, email }, password);
    users().push(user);
    saveUsers();
    startSession(user, f.remember);
    runHook('after-login', publicUser(user));
    emit('*');
    return publicUser(user);
  }

  function logIn(email, password, opts) {
    const o = opts || {};
    if (!normEmail(email)) throw friendly('Enter your email address.', 'email');
    if (!password) throw friendly('Enter your password.', 'password');
    const user = findByEmail(email);
    if (!user || user.hash !== hashPassword(String(password), user.salt)) {
      throw friendly("That email and password don't match.", 'password');
    }
    startSession(user, o.remember !== false);
    runHook('after-login', publicUser(user));
    emit('*');
    return publicUser(user);
  }

  function logOut() {
    if (readJSON(sess, KEYS.session)) {
      // this tab was logged in without "keep me logged in". only this tab logs out, so a
      // remembered login in another tab stays put. readSession() checks this tab's copy first
      writeJSON(sess, KEYS.session, { userId: null, at: new Date().toISOString() });
    } else {
      clearSession();
    }
    dataCache = null;
    emit('*');
  }

  function needUser() {
    const u = me();
    if (!u) throw friendly('Please log in first.');
    return u;
  }

  function updateProfile(fields) {
    const f = fields || {};
    const user = needUser();
    let name = user.name;
    let email = user.email;
    if (f.name !== undefined) {
      name = String(f.name).trim();
      if (!name) throw friendly("Your name can't be empty.", 'name');
    }
    if (f.email !== undefined) {
      email = normEmail(f.email);
      checkEmail(email);
      const other = findByEmail(email);
      if (other && other.id !== user.id) throw friendly('Another account already uses that email.', 'email');
    }
    user.name = name;
    user.email = email;
    saveUsers();
    emit('profile');
    return publicUser(user);
  }

  function changePassword(current, next) {
    const user = needUser();
    if (!current || user.hash !== hashPassword(String(current), user.salt)) {
      throw friendly("Your current password isn't right.", 'current');
    }
    const pw = String(next || '');
    if (pw.length < MIN_PASSWORD) throw friendly('Your new password needs at least 8 characters.', 'next');
    if (pw === String(current)) throw friendly("That's the same as your current password. Pick a new one.", 'next');
    user.salt = randomId(12);
    user.hash = hashPassword(pw, user.salt);
    saveUsers();
  }

  // if this was the demo account, it comes back fresh the next time the list is read,
  // so "use the demo account" on the login screen always works
  function deleteAccount() {
    const user = needUser();
    usersCache = users().filter((u) => u.id !== user.id);
    saveUsers();
    local.remove(KEYS.data(user.id));
    clearSession();
    dataCache = null;
    emit('*');
  }

  // device settings (shared by everyone who uses this browser)

  function settings() {
    const saved = readJSON(local, KEYS.settings);
    const out = Object.assign({}, DEFAULT_SETTINGS);
    if (saved) {
      if (saved.textSize === 'large' || saved.textSize === 'normal') out.textSize = saved.textSize;
      if (typeof saved.reduceMotion === 'boolean') out.reduceMotion = saved.reduceMotion;
      if (typeof saved.haptics === 'boolean') out.haptics = saved.haptics;
    }
    return out;
  }

  function setSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return settings();
    const next = settings();
    if (key === 'textSize') next.textSize = value === 'large' || value === true ? 'large' : 'normal';
    else next[key] = !!value;
    writeJSON(local, KEYS.settings, next);
    applySettings();
    emit('settings');
    return next;
  }

  function applySettings() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const s = settings();
    const cl = document.documentElement.classList;
    cl.toggle('text-lg', s.textSize === 'large');
    cl.toggle('reduce-motion', !!s.reduceMotion);
  }

  // another tab changed something, so stop trusting our copies. if it also means a different
  // person (or nobody) is logged in here now, tell the screens so they redraw or go to welcome
  if (window.addEventListener) {
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.indexOf('needcheck:') !== 0) return;
      const before = lastUserId;
      local.forget(e.key || null);
      usersCache = null;
      dataCache = null;
      if (e.key === KEYS.settings) applySettings();
      const u = me();
      const now = u ? u.id : null;
      if (now === before) return;
      emit('*');
      // the router only redraws live screens by itself. a screen like a check would keep showing
      // the old person, and tapping there would change the new person's data
      if (before && now && NC.router && NC.router.current && NC.router.refresh) {
        const cur = NC.router.current();
        if (cur && cur.def && !cur.def.live) NC.router.refresh();
      }
    });
  }

  NC.store = {
    version: VERSION,
    minPassword: MIN_PASSWORD,
    seed(name, fn) {
      if (!seeds[name]) order.push(name);
      seeds[name] = fn;
    },
    get,
    update,
    set,
    has: (name) => !!seeds[name],
    on(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    resetData,
    currentUser: () => publicUser(me()),
    signUp,
    logIn,
    logOut,
    updateProfile,
    changePassword,
    deleteAccount,
    settings,
    setSetting,
    applySettings,
    isEmail,
  };

  applySettings();
})();
