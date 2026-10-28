// account screens: welcome, log in, sign up, the account page and its sub pages.
// the tour (onboarding.js) and the help pop-ups (help.js) come in later pushes, so we check for them first.
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.dom || !NC.c || !NC.router) return;

  const { h } = NC.dom;
  const c = NC.c;

  const GUEST = ['/welcome', '/login', '/signup'];
  const MIN_PW = (NC.store && NC.store.minPassword) || 8;

  function icon(name, size) {
    return NC.icon(name, { size: size || 20 });
  }

  function appOf(id, fallback) {
    return NC.app ? NC.app(id) : fallback;
  }

  function demoAccount() {
    const s = Array.isArray(NC.seedUsers) ? NC.seedUsers[0] : null;
    return s && s.email ? { email: s.email, password: s.password } : { email: 'jordan@example.com', password: 'needcheck' };
  }

  function isEmail(v) {
    if (NC.store && NC.store.isEmail) return NC.store.isEmail(v);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  }

  function toast(msg, opts) {
    return NC.ui && NC.ui.toast ? NC.ui.toast(msg, opts) : null;
  }

  // where to land after logging in. someone who opened a deep link while logged out
  // (say #/receipts/walmart) should end up there, not on home

  let wanted = null;
  let prefillEmail = '';

  function noteWanted(hash) {
    if (!NC.store || NC.store.currentUser()) return;
    const full = String(hash || '').replace(/^#/, '');
    const path = full.split('?')[0];
    if (!path || path === '/' || path === '/home' || path === '/onboarding' || GUEST.indexOf(path) >= 0) return;
    wanted = full;
  }

  // this file loads before app.js starts the router, so the hash is still the one people opened
  noteWanted(location.hash);
  // typed or tapped links have no router state yet; back and forward do, so those are skipped
  const onNav = () => {
    const st = history.state;
    if (!(st && typeof st.ncIdx === 'number')) noteWanted(location.hash);
  };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);

  function nextPath() {
    const w = wanted;
    wanted = null;
    return w && NC.router.has(w) ? w : '/home';
  }

  // the tour is nicolas's onboarding.js, so it only counts once that file is in. it also skips
  // cards for tabs that aren't pushed yet, so it can still come back with nothing to show
  function tourCount() {
    if (!NC.router.has('/onboarding')) return 0;
    return NC.onboarding && typeof NC.onboarding.count === 'function' ? NC.onboarding.count() : 1;
  }

  // little form helpers

  // the submit button gets a spinner and new words while we pretend to talk to a server
  function busyOn(btn, text) {
    const label = btn.querySelector('.btn-label');
    btn.dataset.idle = label ? label.textContent : '';
    if (label) label.textContent = text;
    btn.disabled = true;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    btn.insertBefore(h('span.btn-spinner', { 'aria-hidden': 'true' }), btn.firstChild);
  }

  function busyOff(btn) {
    const label = btn.querySelector('.btn-label');
    if (label && btn.dataset.idle) label.textContent = btn.dataset.idle;
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    const spin = btn.querySelector('.btn-spinner');
    if (spin) spin.remove();
  }

  function emailField(opts) {
    const f = c.field(Object.assign({
      label: 'Email',
      type: 'email',
      name: 'email',
      autocomplete: 'email',
      inputmode: 'email',
      placeholder: 'you@example.com',
    }, opts || {}));
    f.input.setAttribute('autocapitalize', 'off');
    f.input.setAttribute('spellcheck', 'false');
    // only complain about the format once they leave the box, not while typing
    f.input.addEventListener('blur', () => {
      const v = f.value().trim();
      if (v && !isEmail(v)) f.setError("That doesn't look like an email address. It should look like name@example.com.");
    });
    return f;
  }

  function passwordField(opts) {
    return c.field(Object.assign({ label: 'Password', type: 'password', name: 'password', reveal: true }, opts || {}));
  }

  function clearOnType(fields) {
    fields.forEach((f) => f.input.addEventListener('input', () => f.setError(null)));
  }

  function checkEmail(f) {
    const v = f.value().trim();
    if (!v) return f.setError('Enter your email address.') && false;
    if (!isEmail(v)) return f.setError("That doesn't look like an email address. It should look like name@example.com.") && false;
    f.setError(null);
    return true;
  }

  // the "at least 8 characters" hint turns green with a check once it's true
  function liveRule(f) {
    const hint = f.querySelector('.field-hint');
    if (!hint) return;
    const text = hint.textContent;
    const update = () => {
      const ok = f.value().length >= MIN_PW;
      hint.classList.toggle('is-met', ok);
      hint.replaceChildren(icon(ok ? 'checkCircle' : 'info', 16), h('span', text));
    };
    f.input.addEventListener('input', update);
    hint.classList.add('pw-rule');
    update();
  }

  function storeError(err, fields, fallback) {
    const f = (err && err.field && fields[err.field]) || fallback;
    const msg = (err && err.message) || 'Something went wrong. Try again.';
    if (f) {
      f.setError(msg);
      f.focus();
    } else {
      toast(msg, { tone: 'error' });
    }
  }

  function form(id, children, onSubmit) {
    return h('form.auth-form', {
      id,
      novalidate: true,
      onSubmit: (e) => {
        e.preventDefault();
        onSubmit();
      },
    }, children);
  }

  function later(ms, fn) {
    return setTimeout(fn, ms);
  }

  // welcome

  function welcomeHero() {
    const temple = appOf('temple-run', { color: '#1B2340', icon: 'game' });
    const walmart = appOf('walmart', { color: '#2C7A7B', icon: 'bag' });
    const bit = (cls, node, delay) => h('span', { class: ['wl-bit', cls], style: { '--d': delay + 'ms' } }, node);
    return h('div.wl-hero', { 'aria-hidden': 'true' },
      h('span.wl-ring.wl-ring--outer'),
      h('span.wl-ring.wl-ring--inner'),
      bit('wl-bit--needed', c.verdict('needed'), 160),
      bit('wl-bit--notneeded', c.verdict('not_needed'), 240),
      bit('wl-bit--optional', c.verdict('optional'), 320),
      bit('wl-bit--temple', c.appTile(temple, { size: 40 }), 400),
      bit('wl-bit--walmart', c.appTile(walmart, { size: 34 }), 460),
      h('span.app-mark.wl-mark', NC.icon('shield', { size: 46 })));
  }

  // first thing a new person sees, so it says what the app is before asking for anything
  function welcomeScreen() {
    const feature = (iconName, title, sub) => c.row({
      left: c.iconTile(iconName, { tone: 'white', shape: 'square', size: 42 }),
      title,
      subtitle: sub,
    });
    return c.screen({
      className: 'wl-screen',
      body: h('div.wl-wrap',
        welcomeHero(),
        h('div.wl-head',
          c.title('NeedCheck', { className: 'wl-title' }),
          h('p.lead.wl-tagline', "Check what apps ask for, set rules once, and take back what you've shared.")),
        c.list([
          feature('search', 'Check every ask', 'Plain words on what an app wants and why.'),
          feature('rules', 'Set your rules once', 'We answer cookie banners for you.'),
          feature('receipt', 'Keep receipts', 'See what you shared and take it back.'),
        ], { className: 'wl-features' })),
      footer: [
        c.button('Create an account', { onClick: () => NC.router.go('/signup') }),
        c.button('I already have an account', { variant: 'secondary', onClick: () => NC.router.go('/login') }),
      ],
    });
  }

  // log in

  function loginScreen() {
    const email = emailField({ value: prefillEmail || '' });
    prefillEmail = '';
    const pass = passwordField({ autocomplete: 'current-password' });
    clearOnType([email, pass]);

    const keepId = NC.dom.uid('keep');
    const keep = c.checkbox({ checked: true, id: keepId, labelledBy: keepId + '-label' });
    const submitBtn = c.button('Log in', { type: 'submit' });
    let busy = false;
    let hint = null;

    // for testers and the TA: one tap and the demo login is ready to go
    function fillDemo() {
      const d = demoAccount();
      email.setValue(d.email).setError(null);
      pass.setValue(d.password).setError(null);
      [email, pass].forEach((f) => {
        f.classList.remove('is-filled');
        void f.offsetWidth;
        f.classList.add('is-filled');
      });
      submitBtn.focus({ preventScroll: true });
      hint = toast('Demo account filled in. Tap Log in.', { tone: 'info', icon: 'user', duration: 2600 });
    }

    function submit() {
      if (busy) return;
      // they did what the hint said, so it shouldn't ride along onto home over the avatar
      if (hint) hint.close();
      hint = null;
      const okEmail = checkEmail(email);
      let okPass = true;
      if (!pass.value()) {
        pass.setError('Enter your password.');
        okPass = false;
      }
      if (!okEmail || !okPass) {
        (okEmail ? pass : email).focus();
        return;
      }
      // a short pause so the busy state is actually seen, logging in is instant otherwise
      busy = true;
      busyOn(submitBtn, 'Logging in…');
      later(450, () => {
        if (!submitBtn.isConnected) return;
        try {
          NC.store.logIn(email.value().trim(), pass.value(), { remember: keep.isOn() });
          NC.router.go(nextPath(), { replace: true, transition: 'fade' });
        } catch (err) {
          busy = false;
          busyOff(submitBtn);
          storeError(err, { email, password: pass }, pass);
          if (err && err.field === 'password') pass.input.select();
        }
      });
    }

    return c.screen({
      nav: c.navBar({ back: '/welcome' }),
      className: 'auth-screen',
      body: [
        h('div.auth-head',
          c.title('Welcome back'),
          h('p.lead', 'Log in to see your checks, rules and receipts.')),
        form('login-form', [
          email,
          pass,
          h('div.auth-options',
            h('div.auth-keep', keep, h('label.auth-keep-label', { for: keepId, id: keepId + '-label' }, 'Keep me logged in')),
            h('button.link.auth-forgot', { type: 'button', onClick: () => forgotSheet(fillDemo) }, 'Forgot password?')),
          submitBtn,
        ], submit),
        c.card(c.row({
          left: c.iconTile('user', { tone: 'peach', size: 40 }),
          title: 'Use the demo account',
          subtitle: "Fills in Jordan's email and password",
          // no chevron, it fills the boxes right here instead of opening anything
          chevron: false,
          onClick: fillDemo,
        }), { tone: 'cream', className: 'auth-demo' }),
        h('p.auth-switch', 'New to NeedCheck? ',
          h('button.link', { type: 'button', onClick: () => NC.router.go('/signup', { replace: true }) }, 'Create an account')),
      ],
    });
  }

  // there's no real email reset in a class demo, so explain that and offer the two ways forward
  function forgotSheet(fillDemo) {
    if (!NC.ui) return;
    NC.ui.sheet({
      title: 'Forgot your password?',
      className: 'help-sheet',
      body: [
        h('p.help-text', "NeedCheck is a class demo, so accounts only live in this browser and there's no reset email."),
        h('p.help-text', 'You can use the demo account, or make a new account in a few seconds.'),
      ],
      footer: (s) => [
        c.button('Use the demo account', { onClick: () => { s.close(); fillDemo(); } }),
        c.button('Create a new account', { variant: 'secondary', onClick: () => { s.close(); NC.router.go('/signup', { replace: true }); } }),
      ],
    });
  }

  // sign up

  function signupScreen() {
    const name = c.field({ label: 'Name', name: 'name', autocomplete: 'name', placeholder: 'First and last name' });
    name.input.setAttribute('autocapitalize', 'words');
    const email = emailField();
    const pass = passwordField({ autocomplete: 'new-password', hint: 'At least ' + MIN_PW + ' characters' });
    liveRule(pass);
    clearOnType([name, email, pass]);

    // shows up under the email error when that address already has an account
    const loginInstead = h('button.link.auth-instead', {
      type: 'button',
      hidden: true,
      onClick: () => {
        prefillEmail = email.value().trim();
        NC.router.go('/login', { replace: true });
      },
    }, 'Log in with this email', icon('arrowRight', 16));
    email.appendChild(loginInstead);
    email.input.addEventListener('input', () => { loginInstead.hidden = true; });

    const submitBtn = c.button('Create account', { type: 'submit' });
    let busy = false;

    function submit() {
      if (busy) return;
      const bad = [];
      if (!name.value().trim()) {
        name.setError('Enter your name so we know what to call you.');
        bad.push(name);
      }
      if (!checkEmail(email)) bad.push(email);
      if (pass.value().length < MIN_PW) {
        pass.setError(pass.value() ? 'Your password needs at least ' + MIN_PW + ' characters.' : 'Make up a password with at least ' + MIN_PW + ' characters.');
        bad.push(pass);
      }
      if (bad.length) {
        bad[0].focus();
        return;
      }
      busy = true;
      busyOn(submitBtn, 'Creating your account…');
      later(550, () => {
        if (!submitBtn.isConnected) return;
        try {
          NC.store.signUp({ name: name.value(), email: email.value(), password: pass.value() });
          NC.router.go(tourCount() ? '/onboarding' : nextPath(), { replace: true, transition: 'fade' });
        } catch (err) {
          busy = false;
          busyOff(submitBtn);
          storeError(err, { name, email, password: pass }, email);
          if (err && err.field === 'email' && /already/i.test(err.message)) loginInstead.hidden = false;
        }
      });
    }

    return c.screen({
      nav: c.navBar({ back: '/welcome' }),
      className: 'auth-screen',
      body: [
        h('div.auth-head',
          c.title('Create your account'),
          h('p.lead', 'Make an account to keep your checks, rules and receipts.')),
        form('signup-form', [name, email, pass, submitBtn], submit),
        h('p.auth-fine', 'NeedCheck is a class demo, so any email works. We never send you anything.'),
        h('p.auth-switch', 'Already have an account? ',
          h('button.link', { type: 'button', onClick: () => NC.router.go('/login', { replace: true }) }, 'Log in')),
      ],
    });
  }

  // account

  function avatar(name, cls) {
    return h('span', { class: ['acct-avatar', cls], 'aria-hidden': 'true' }, NC.dom.initials(name));
  }

  function setRow(iconName, title, sub, opts) {
    const o = opts || {};
    return c.row({
      left: c.iconTile(iconName, { tone: o.tone || 'cream', shape: 'square', size: 34, iconSize: 20 }),
      title,
      subtitle: sub,
      chevron: o.chevron !== false,
      onClick: o.onClick,
      className: o.className,
    });
  }

  function toggleRow(iconName, title, sub, opts) {
    const id = NC.dom.uid('setting');
    const t = c.toggle({ checked: opts.checked, labelledBy: id, describedBy: id + '-sub', disabled: opts.disabled, onChange: opts.onChange });
    return c.row({
      left: c.iconTile(iconName, { tone: 'cream', shape: 'square', size: 34, iconSize: 20 }),
      title: h('span', { id }, title),
      subtitle: h('span', { id: id + '-sub' }, sub),
      right: t,
      className: 'acct-toggle-row',
    });
  }

  function group(label, rows) {
    return c.section(label, c.card(c.list(rows), { className: 'acct-group' }));
  }

  function memberSince(user) {
    const d = new Date(user.createdAt);
    return isNaN(d) ? '' : 'Member since ' + NC.dom.fmtDate(d, 'long');
  }

  // iPhones don't have navigator.vibrate, so the switch says so instead of doing nothing
  function canVibrate() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  // grouped white cards like iOS settings
  function accountScreen() {
    const user = NC.store.currentUser();
    if (!user) return null;
    const s = NC.store.settings();
    const vibrate = canVibrate();
    const tour = tourCount();
    // the ratings sheet is in bianca's help.js, so that row waits for it too
    const rates = !!(NC.help && typeof NC.help.showRatings === 'function');

    const accountRows = [
      setRow('user', 'Profile', 'Your name and email', { onClick: () => NC.router.go('/account/profile') }),
      setRow('key', 'Password', 'Change your password', { onClick: () => NC.router.go('/account/password') }),
    ];
    // Tri's masked details page only shows up once the rules part is in
    if (NC.router.has('/rules/masked')) {
      accountRows.push(setRow('mask', 'Your masked details', 'Stand-in email and number that still reach you', { onClick: () => NC.router.go('/rules/masked') }));
    }

    return c.screen({
      nav: c.navBar({ title: 'Account', back: '/home' }),
      className: 'acct-screen',
      body: [
        h('div.acct-head',
          avatar(user.name),
          h('h2.title-lg.acct-name', user.name),
          h('p.acct-email', user.email),
          h('p.acct-since', memberSince(user))),
        group('Your account', accountRows),
        group('Settings', [
          toggleRow('textSize', 'Larger text', 'Makes all the text bigger', {
            checked: s.textSize === 'large',
            onChange: (on) => NC.store.setSetting('textSize', on ? 'large' : 'normal'),
          }),
          toggleRow('wave', 'Reduce motion', 'Turns off sliding and fading', {
            checked: !!s.reduceMotion,
            onChange: (on) => NC.store.setSetting('reduceMotion', on),
          }),
          toggleRow('vibrate', 'Vibration on tap', vibrate ? 'A tiny buzz when you flip a switch' : "This browser can't vibrate", {
            checked: vibrate && s.haptics !== false,
            disabled: !vibrate,
            onChange: (on) => NC.store.setSetting('haptics', on),
          }),
        ]),
        group('Help', [
          tour ? setRow('help', 'How NeedCheck works', tour === 3 ? 'A quick tour of the three tabs' : 'A quick tour of the app', { onClick: () => NC.router.go('/onboarding?replay=1') }) : null,
          rates ? setRow('checkCircle', 'How we rate apps', 'What our three ratings mean', { onClick: () => NC.help.showRatings() }) : null,
          setRow('info', 'About this demo', 'Who made NeedCheck and what is real', { onClick: aboutSheet }),
        ]),
        group('Demo data', [
          setRow('refresh', 'Reset demo data', 'Start the tasks over. Your account stays.', { chevron: false, onClick: resetData }),
        ]),
        h('div.acct-end', c.card(c.list([
          setRow('logout', 'Log out', null, { chevron: false, onClick: logOut }),
          setRow('trash', 'Delete account', null, { chevron: false, tone: 'red', className: 'acct-danger', onClick: deleteAccount }),
        ]), { className: 'acct-group' })),
        h('p.acct-foot', 'NeedCheck · a class demo by Team 18'),
      ],
    });
  }

  function resetData() {
    NC.ui.confirm({
      title: 'Reset demo data?',
      message: 'Every request, rule and receipt goes back to how the demo starts. Your account stays.',
      confirmLabel: 'Reset',
      danger: true,
      icon: 'refresh',
    }).then((ok) => {
      if (!ok) return;
      NC.store.resetData();
      // force, since home has to redraw with the fresh data even if it's the same path
      NC.router.go('/home', { replace: true, transition: 'fade', force: true });
      // same words as the reset button in the desktop side panel
      toast('Demo data is back to the start');
    });
  }

  function logOut() {
    NC.ui.confirm({
      title: 'Log out?',
      message: 'Your checks, rules and receipts stay saved for next time.',
      confirmLabel: 'Log out',
      icon: 'logout',
    }).then((ok) => {
      if (!ok) return;
      // go to welcome ourselves so the router's own logged out bounce has nothing left to do
      wanted = null;
      NC.store.logOut();
      NC.router.go('/welcome', { replace: true, transition: 'fade' });
      toast('Logged out', { tone: 'info', icon: 'logout' });
    });
  }

  function deleteAccount() {
    const user = NC.store.currentUser();
    if (!user) return;
    const demo = user.email === demoAccount().email;
    NC.ui.confirm({
      title: 'Delete your account?',
      message: 'This removes ' + user.name + ' and all their checks, rules and receipts from this browser. You can\'t undo it.' +
        (demo ? ' The demo account comes back fresh the next time someone uses it.' : ''),
      confirmLabel: 'Delete account',
      danger: true,
      icon: 'trash',
    }).then((ok) => {
      if (!ok) return;
      wanted = null;
      NC.store.deleteAccount();
      NC.router.go('/welcome', { replace: true, transition: 'fade' });
      toast('Account deleted', { tone: 'info', icon: 'trash' });
    });
  }

  function aboutSheet() {
    const d = demoAccount();
    const line = (iconName, text) => h('li.about-line', c.iconTile(iconName, { tone: 'cream', size: 34, iconSize: 18 }), h('span', text));
    NC.ui.sheet({
      className: 'help-sheet',
      body: [
        h('div.help-top', h('span.app-mark', NC.icon('shield', { size: 26 }))),
        h('h2.title-lg.help-title', 'About this demo'),
        h('p.help-text', 'NeedCheck is a class prototype by Team 18 (CS 4352). The apps, data and company practices shown are made-up examples.'),
        h('ul.about-lines',
          line('lock', 'Your account and choices stay in this browser. Nothing is sent anywhere.'),
          line('refresh', 'Reset demo data puts every request, rule and receipt back to the start.'),
          line('user', 'Demo account: ' + d.email + ', password ' + d.password + '.')),
        h('p.help-small', 'Made by Danyal Nawab, Umair Malik, Bianca Hernandez, Tri Nguyen and Nicolas Price.'),
      ],
      footer: (sh) => c.button('Got it', { variant: 'dark', onClick: () => sh.close() }),
    });
  }

  // profile and password

  // asks before throwing away typed changes when someone taps back
  function leaveGuard(isDirty) {
    return () => {
      if (!isDirty()) {
        NC.router.back('/account');
        return;
      }
      NC.ui.confirm({
        title: 'Discard your changes?',
        message: "What you typed here won't be saved.",
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      }).then((ok) => {
        if (ok) NC.router.back('/account');
      });
    };
  }

  // save stays off until something actually changed
  function profileScreen() {
    const user = NC.store.currentUser();
    if (!user) return null;
    const name = c.field({ label: 'Name', name: 'name', autocomplete: 'name', value: user.name });
    name.input.setAttribute('autocapitalize', 'words');
    const email = emailField({ value: user.email, hint: 'You log in with this email.' });
    clearOnType([name, email]);

    const pic = avatar(user.name, 'acct-avatar--edit');
    const saveBtn = c.button('Save changes', { type: 'submit', disabled: true });
    saveBtn.setAttribute('form', 'profile-form');
    let busy = false;

    const dirty = () => name.value().trim() !== user.name || email.value().trim().toLowerCase() !== user.email;
    // the avatar follows the name as you type, so you can see the new initials before saving
    const sync = () => {
      pic.textContent = NC.dom.initials(name.value() || user.name);
      if (!busy) saveBtn.disabled = !dirty();
    };
    name.input.addEventListener('input', sync);
    email.input.addEventListener('input', sync);

    function submit() {
      if (busy || !dirty()) return;
      const bad = [];
      if (!name.value().trim()) {
        name.setError("Your name can't be empty.");
        bad.push(name);
      }
      if (!checkEmail(email)) bad.push(email);
      if (bad.length) {
        bad[0].focus();
        return;
      }
      busy = true;
      busyOn(saveBtn, 'Saving…');
      later(350, () => {
        if (!saveBtn.isConnected) return;
        try {
          NC.store.updateProfile({ name: name.value(), email: email.value() });
          toast('Profile saved');
          NC.router.back('/account');
        } catch (err) {
          busy = false;
          busyOff(saveBtn);
          storeError(err, { name, email }, email);
        }
      });
    }

    return c.screen({
      nav: c.navBar({ title: 'Profile', back: leaveGuard(dirty) }),
      className: 'acct-edit',
      body: [
        h('div.acct-edit-pic', pic),
        form('profile-form', [name, email], submit),
      ],
      footer: saveBtn,
    });
  }

  function passwordScreen() {
    if (!NC.store.currentUser()) return null;
    const current = passwordField({ label: 'Current password', name: 'current', autocomplete: 'current-password' });
    const next = passwordField({ label: 'New password', name: 'next', autocomplete: 'new-password', hint: 'At least ' + MIN_PW + ' characters' });
    liveRule(next);
    clearOnType([current, next]);

    const saveBtn = c.button('Change password', { type: 'submit' });
    saveBtn.setAttribute('form', 'password-form');
    let busy = false;

    function submit() {
      if (busy) return;
      const bad = [];
      if (!current.value()) {
        current.setError('Enter the password you use now.');
        bad.push(current);
      }
      if (next.value().length < MIN_PW) {
        next.setError(next.value() ? 'Your new password needs at least ' + MIN_PW + ' characters.' : 'Make up a new password with at least ' + MIN_PW + ' characters.');
        bad.push(next);
      }
      if (bad.length) {
        bad[0].focus();
        return;
      }
      busy = true;
      busyOn(saveBtn, 'Changing…');
      later(400, () => {
        if (!saveBtn.isConnected) return;
        try {
          NC.store.changePassword(current.value(), next.value());
          toast('Password changed');
          NC.router.back('/account');
        } catch (err) {
          busy = false;
          busyOff(saveBtn);
          storeError(err, { current, next }, current);
          if (err && err.field === 'current') current.input.select();
        }
      });
    }

    return c.screen({
      nav: c.navBar({ title: 'Password', back: leaveGuard(() => !!(current.value() || next.value())) }),
      className: 'acct-edit',
      body: [
        h('p.lead.acct-edit-lead', "Pick something you'll remember. You'll need it the next time you log in."),
        form('password-form', [current, next], submit),
      ],
      footer: saveBtn,
    });
  }

  // the tour ends by going where the person was headed, so it borrows this instead of keeping its own copy
  NC.account = { nextPath };

  // no store means push 1 only, where there are no accounts to show yet
  if (!NC.store) return;

  const guest = { auth: false, guestOnly: true, tab: null };
  NC.router.add('/welcome', Object.assign({ title: 'Welcome', render: welcomeScreen }, guest));
  NC.router.add('/login', Object.assign({ title: 'Log in', render: loginScreen }, guest));
  NC.router.add('/signup', Object.assign({ title: 'Create account', render: signupScreen }, guest));
  NC.router.add('/account', { tab: 'home', title: 'Account', render: accountScreen });
  NC.router.add('/account/profile', { tab: null, title: 'Profile', render: profileScreen });
  NC.router.add('/account/password', { tab: null, title: 'Password', render: passwordScreen });
})();
