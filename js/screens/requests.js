// part of task 3: ask a company to delete your data
// then "make this a rule?" and the cleanup screen. receipts are nicolas's
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.router || !NC.c) return;
  const { h } = NC.dom;
  const c = NC.c;

  // half-finished requests, so a reload on the letter keeps your edits
  if (NC.store) NC.store.seed('deleteDrafts', () => ({}));

  // email is how they find your account, and cookies / marketing get switched off on take back, not deleted
  const SKIP = ['email', 'adCookies', 'analyticsCookies', 'loginCookies', 'marketing', 'notifications', 'camera', 'microphone', 'orders', 'account'];
  const WORDS = {
    birthday: 'birthday', phone: 'phone number', location: 'location history', contacts: 'contacts', health: 'health data',
    photos: 'photos', files: 'uploaded files', payment: 'saved payment card', orders: 'order history',
  };
  const REASONS = [
    { id: 'unused', label: "I don't use it anymore", line: (app) => "I don't use my " + app.name + " account anymore, so there's no reason to keep my information." },
    { id: 'ads', label: 'Too many ads', line: () => "I'm getting too many ads, and I don't want my information used for them." },
    // their own words get a little lead-in, so the letter doesn't end on a stray fragment
    { id: 'other', label: 'Something else', line: (app, text) => (sentence(text) ? 'My reason: ' + sentence(text) : '') },
  ];
  // the rule we offer after sending depends on what kind of app it was
  const RULE_FOR = {
    shopping: { id: 'shopping-masked', title: 'Shopping sites', what: 'every shopping site', icon: 'bag' },
    food: { id: 'food-masked', title: 'Food delivery apps', what: 'every food delivery app', icon: 'food' },
    games: { id: 'games-masked', title: 'Games', what: 'every game', icon: 'game' },
    social: { id: 'social-masked', title: 'Social media', what: 'every social media app', icon: 'chat' },
    news: { id: 'news-masked', title: 'News sites', what: 'every news site', icon: 'news' },
  };

  function toast(msg, opts) {
    return NC.ui && NC.ui.toast ? NC.ui.toast(msg, opts) : null;
  }

  function ask(o) {
    return NC.ui && NC.ui.confirm ? NC.ui.confirm(o) : Promise.resolve(true);
  }

  function typeLabel(t) {
    return (NC.dataType ? NC.dataType(t).label : t).toLowerCase();
  }

  function sentence(t) {
    let s = String(t || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    s = s[0].toUpperCase() + s.slice(1);
    return /[.!?]$/.test(s) ? s : s + '.';
  }

  function word(type) {
    return WORDS[type] || (NC.dataType ? NC.dataType(type).label.toLowerCase() : type);
  }

  function appFor(rec) {
    return NC.app ? NC.app(rec.appId || rec.id) : { id: rec.id, name: rec.id, color: '#57534A', icon: 'globe', rulesCategory: 'other', contact: '' };
  }

  function contactFor(app) {
    return app.contact || 'privacy@' + String(app.id || 'company').replace(/[^a-z0-9]/gi, '') + '.com';
  }

  function getReceipt(id) {
    if (!NC.receipts || typeof NC.receipts.get !== 'function') return null;
    try {
      return NC.receipts.get(id) || null;
    } catch (e) {
      console.error('could not read receipt ' + id, e);
      return null;
    }
  }

  function addDays(dateIso, n) {
    const d = new Date(dateIso || Date.now());
    d.setDate(d.getDate() + (Number(n) || 45));
    return d;
  }

  function daysLeft(del) {
    const due = addDays(del.sentAt, del.dueDays || 45);
    return NC.dom.daysBetween(new Date(), due);
  }

  function dueText(del) {
    return NC.dom.fmtDate(addDays(del.sentAt, del.dueDays || 45), 'short');
  }

  function gone(item) {
    if (NC.receipts && typeof NC.receipts.isGone === 'function') return NC.receipts.isGone(item);
    return ['not_shared', 'declined', 'deleted'].indexOf(item.status) >= 0;
  }

  // what you can ask them to delete: the receipts items, then order history and the whole account
  function choices(rec, app) {
    const items = (rec.items || []).filter((i) => i && SKIP.indexOf(i.type) < 0 && !gone(i));
    // things you can't take back any other way go first (walmart birthday)
    const sorted = items.filter((i) => !i.takeBack).concat(items.filter((i) => i.takeBack));
    const out = sorted.map((i) => ({ type: i.type, label: 'My ' + word(i.type), icon: NC.dataType ? NC.dataType(i.type).icon : 'file' }));
    const orders = (rec.items || []).some((i) => i && i.type === 'orders') || ['shopping', 'food'].indexOf(app.rulesCategory) >= 0;
    if (orders) out.push({ type: 'orders', label: 'My order history', icon: 'bag' });
    out.push({ type: 'account', label: 'My whole account (close it)', icon: 'trash' });
    return out;
  }

  // messageFor = the picks a custom message was written for. editText = what's in the box while editing
  function blankDraft() {
    return { items: [], reason: null, other: '', message: null, messageFor: null, editText: null };
  }

  function getDraft(id) {
    const all = NC.store ? NC.store.get('deleteDrafts') : null;
    return Object.assign(blankDraft(), (all && all[id]) || {});
  }

  function saveDraft(id, d) {
    if (!NC.store) return;
    NC.store.update('deleteDrafts', (all) => {
      const next = all && typeof all === 'object' ? all : {};
      next[id] = d;
      return next;
    });
  }

  function clearDraft(id) {
    if (!NC.store) return;
    NC.store.update('deleteDrafts', (all) => {
      const next = all && typeof all === 'object' ? all : {};
      delete next[id];
      return next;
    });
  }

  function reasonText(d) {
    if (d.reason === 'other') return sentence(d.other) || 'Something else';
    const r = REASONS.find((x) => x.id === d.reason);
    return r ? r.label : null;
  }

  // what to delete, why (if they said), the account email
  function buildLetter(app, d, user) {
    const closing = d.items.indexOf('account') >= 0;
    const words = d.items.filter((t) => t !== 'account').map(word);
    const incl = words.length ? ', including my ' + NC.dom.listText(words) : '';
    const ask = closing
      ? 'I\'m asking you to close my account and delete all the personal data you hold about me' + incl + ", and to confirm when it's done."
      : 'I\'m asking you to delete the personal data you hold about me' + incl + ", and to confirm when it's done.";
    const r = REASONS.find((x) => x.id === d.reason);
    const why = r ? r.line(app, d.other) : '';
    const name = (user && user.name) || '';
    return [
      'Hi ' + app.name + ' team,',
      ask + (why ? ' ' + why : ''),
      "I'm making this request under the privacy rights my state gives me.",
      user && user.email ? 'Account email: ' + user.email : null,
      'Thanks,' + (name ? '\n' + name : ''),
    ].filter(Boolean).join('\n\n');
  }

  function subjectFor(d) {
    return d.items.indexOf('account') >= 0 ? 'Request to close my account and delete my data' : 'Request to delete my personal data';
  }

  function deletionLine(app, del) {
    const items = del.items || [];
    const words = items.filter((t) => t !== 'account').map(word);
    if (items.indexOf('account') >= 0) return 'Asked ' + app.name + ' to close your account and delete your data';
    return 'Asked ' + app.name + ' to delete your ' + NC.dom.listText(words);
  }

  // pop back to a screen we already have instead of piling up a new one
  function popTo(path, transition) {
    if (typeof NC.router.popTo === 'function') NC.router.popTo(path, transition || 'back');
    else NC.router.go(path, { transition: transition || 'back' });
  }

  function receiptPath(id) {
    return '/receipts/' + encodeURIComponent(id);
  }

  function missingScreen() {
    const hasList = NC.router.has('/receipts');
    return c.screen({
      nav: c.navBar({ title: 'Delete request', back: hasList ? '/receipts' : '/home' }),
      body: c.empty({
        icon: 'receipt',
        title: "We couldn't find that receipt",
        text: 'It may have been removed, or the link is out of date.',
        action: c.button(hasList ? 'Go to receipts' : 'Go to home', { variant: 'secondary', block: false, onClick: () => NC.router.go(hasList ? '/receipts' : '/home', { transition: 'fade' }) }),
      }),
    });
  }

  function alreadySentScreen(rec, app) {
    const del = rec.deletion;
    return c.screen({
      nav: c.navBar({ title: 'Delete request', back: receiptPath(rec.id) }),
      className: 'dr-screen',
      body: c.empty({
        icon: 'clock',
        tone: 'amber',
        title: 'You already asked ' + app.name,
        text: 'Sent ' + NC.dom.fmtDate(del.sentAt, 'short') + '. They have until ' + dueText(del) + ' to reply, and we track it in the receipt.',
        action: c.button('View ' + app.name + ' receipt', { variant: 'secondary', block: false, onClick: () => popTo(receiptPath(rec.id)) }),
      }),
    });
  }

  // what should walmart delete
  function deleteScreen(params, query) {
    const id = params.id;
    const rec = getReceipt(id);
    if (!rec) return missingScreen();
    const app = appFor(rec);
    if (rec.deletion && rec.deletion.status === 'sent') return alreadySentScreen(rec, app);
    const list = choices(rec, app);
    const d = getDraft(id);
    d.items = d.items.filter((t) => list.some((x) => x.type === t));
    // "ask walmart to delete it" on a take back row says which item, so that box starts ticked
    const pick = query && query.pick;
    if (!d.items.length && pick && list.some((x) => x.type === pick)) {
      d.items = [pick];
      saveDraft(id, d);
    }
    const boxes = {};
    const dataTypes = list.filter((x) => x.type !== 'account').map((x) => x.type);

    const cont = c.button('Continue', { disabled: !d.items.length, onClick: () => NC.router.go(receiptPath(id) + '/delete/review') });
    const need = h('p.dr-need', { hidden: !!d.items.length, 'aria-live': 'polite' }, 'Tick at least one thing to continue.');
    const accountHint = h('p.dr-hint', { hidden: d.items.indexOf('account') < 0 }, NC.icon('info', { size: 18 }),
      'Closing your account also deletes everything else ' + app.name + ' holds about you.');
    const allLink = h('button.link', { type: 'button', onClick: () => toggleAll() }, 'Select all');

    function sync() {
      const has = d.items.length > 0;
      cont.disabled = !has;
      need.hidden = has;
      accountHint.hidden = d.items.indexOf('account') < 0;
      const allOn = dataTypes.length > 0 && dataTypes.every((t) => d.items.indexOf(t) >= 0);
      allLink.textContent = allOn ? 'Clear' : 'Select all';
      saveDraft(id, d);
    }

    function setItem(type, on) {
      const at = d.items.indexOf(type);
      if (on && at < 0) d.items.push(type);
      if (!on && at >= 0) d.items.splice(at, 1);
      // keep them in screen order so the letter lists them the same way
      d.items = list.map((x) => x.type).filter((t) => d.items.indexOf(t) >= 0);
      sync();
    }

    // select all ticks every piece of data but never closes the account by itself
    function toggleAll() {
      const allOn = dataTypes.every((t) => d.items.indexOf(t) >= 0);
      dataTypes.forEach((t) => boxes[t].setOn(!allOn, true));
      dataTypes.forEach((t) => {
        const at = d.items.indexOf(t);
        if (!allOn && at < 0) d.items.push(t);
        if (allOn && at >= 0) d.items.splice(at, 1);
      });
      d.items = list.map((x) => x.type).filter((t) => d.items.indexOf(t) >= 0);
      sync();
    }

    const rows = list.map((x) => {
      const box = c.checkbox({ id: 'dr-box-' + x.type, checked: d.items.indexOf(x.type) >= 0, label: x.label, onChange: (on) => setItem(x.type, on) });
      boxes[x.type] = box;
      const row = c.row({ left: NC.icon(x.icon, { size: 22 }), title: x.label, right: box, className: 'dr-pick' });
      // the whole row is the tap target, not just the little box
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.checkbox')) box.click();
      });
      return row;
    });

    
    const otherField = c.field({
      label: 'Tell them why',
      multiline: true,
      rows: 2,
      value: d.other,
      placeholder: "Like: I'm moving to a different store",
      className: 'dr-other',
      onInput: (v) => {
        d.other = v;
        saveDraft(id, d);
      },
    });
    otherField.hidden = d.reason !== 'other';

    const reasonBtns = REASONS.map((r) => h('button.dr-reason', {
      type: 'button',
      'aria-pressed': d.reason === r.id,
      onClick: () => {
        d.reason = d.reason === r.id ? null : r.id;
        reasonBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(d.reason === REASONS[i].id)));
        otherField.hidden = d.reason !== 'other';
        saveDraft(id, d);
      },
    }, NC.icon('check', { size: 16, stroke: 3 }), h('span', r.label)));

    return c.screen({
      nav: c.navBar({ title: 'Delete request', back: receiptPath(id) }),
      className: 'dr-pickpage',
      body: [
        c.title('What should ' + app.name + ' delete?', { size: 'lg', className: 'dr-title' }),
        h('p.lead.dr-lead', "We'll write the request for you. Companies usually have 45 days to reply."),
        h('div.dr-all', h('p.dr-all-tip', 'Tick all that apply.'), allLink),
        c.card(c.list(rows), { className: 'dr-card' }),
        accountHint,
        h('section.dr-why', { 'aria-labelledby': 'dr-why-label' },
          h('h2.label.dr-why-label', { id: 'dr-why-label' }, 'Why are you making this change? (Optional)'),
          h('div.dr-reasons', { role: 'group', 'aria-labelledby': 'dr-why-label' }, reasonBtns),
          otherField),
      ],
      footer: [need, cont],
    });
  }

  // the drafted letter
  function reviewScreen(params) {
    const id = params.id;
    const rec = getReceipt(id);
    if (!rec) return missingScreen();
    const app = appFor(rec);
    if (rec.deletion && rec.deletion.status === 'sent') return alreadySentScreen(rec, app);
    const d = getDraft(id);
    if (!d.items.length) {
      // browser forward with nothing ticked: back to the pick screen. force, since that screen may still be the one up
      NC.router.go(receiptPath(id) + '/delete', { replace: true, force: true, transition: 'none' });
      return null;
    }
    const user = NC.store ? NC.store.currentUser() : null;
    const drafted = buildLetter(app, d, user);
    let text = d.message || drafted;
    let editing = false;
    // a message written for other picks goes stale when they change what to delete
    const picksKey = () => JSON.stringify([d.items.slice().sort(), d.reason, d.other]);
    const isStale = () => !!d.message && d.messageFor != null && d.messageFor !== picksKey();

    const bodyEl = h('p.dr-letter-body', text);
    const field = c.field({ label: 'Your message', multiline: true, rows: 13, value: text, className: 'dr-edit-field' });
    const ta = field.input;
    const editLink = h('button.link.dr-edit-link', { type: 'button', onClick: () => startEdit() }, NC.icon('edit', { size: 18 }), 'Edit message');
    const resetLink = h('button.link.dr-reset', { type: 'button', hidden: !d.message, onClick: () => resetText() }, NC.icon('undo', { size: 18 }), 'Use our draft again');
    const staleHint = h('p.dr-hint.dr-stale', { hidden: !isStale() }, NC.icon('alert', { size: 18 }),
      'You changed what to delete after editing this. Check the message, or use our draft again.');
    const editBox = h('div.dr-edit', { hidden: true },
      field,
      h('div.btn-row.dr-edit-btns',
        c.button('Save', { small: true, onClick: () => saveEdit() }),
        c.button('Cancel', { variant: 'secondary', small: true, onClick: () => exitEdit() })));
    const where = h('p.dr-where-text', { id: 'dr-where', hidden: true }, 'From ' + app.name + "'s privacy policy. It's the address they list for privacy requests.");
    const whereBtn = h('button.dr-where', {
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'dr-where',
      onClick: () => {
        where.hidden = !where.hidden;
        whereBtn.setAttribute('aria-expanded', String(!where.hidden));
      },
    }, NC.icon('info', { size: 16 }), "Where's this address from?");

    // the box grows with the letter, so only page scrolls
    function fit() {
      if (!ta.isConnected) return;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + (ta.offsetHeight - ta.clientHeight) + 'px';
    }

    // what they type is kept as they go, so a reload or back doesn't lose it
    let keepTimer = null;
    function keepTyping() {
      clearTimeout(keepTimer);
      keepTimer = setTimeout(() => {
        if (!editing) return;
        d.editText = field.value();
        saveDraft(id, d);
      }, 300);
    }

    function dropTyping() {
      clearTimeout(keepTimer);
      if (d.editText == null) return;
      d.editText = null;
      saveDraft(id, d);
    }

    ta.addEventListener('input', () => {
      field.setError(null);
      fit();
      keepTyping();
    });
    ta.addEventListener('focus', fit);

    // quiet = reopening after a reload, so no focus jump while the screen is still being drawn
    function startEdit(value, quiet) {
      editing = true;
      field.setValue(value != null ? value : text);
      field.setError(null);
      bodyEl.hidden = true;
      editLink.hidden = true;
      resetLink.hidden = true;
      staleHint.hidden = true;
      editBox.hidden = false;
      if (quiet) {
        requestAnimationFrame(fit);
        return;
      }
      fit();
      // start at the top of the letter, not the end
      field.focus();
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0;
    }

    function exitEdit() {
      editing = false;
      dropTyping();
      bodyEl.hidden = false;
      editLink.hidden = false;
      resetLink.hidden = !d.message;
      staleHint.hidden = !isStale();
      editBox.hidden = true;
      editLink.focus();
    }

    function saveEdit() {
      const val = field.value().trim();
      if (!val) {
        field.setError("The message can't be empty.");
        field.focus();
        return false;
      }
      text = val;
      d.message = val === drafted ? null : val;
      d.messageFor = d.message ? picksKey() : null;
      d.editText = null;
      clearTimeout(keepTimer);
      saveDraft(id, d);
      bodyEl.textContent = text;
      exitEdit();
      toast('Message updated', { tone: 'success' });
      return true;
    }

    function resetText() {
      text = drafted;
      d.message = null;
      d.messageFor = null;
      saveDraft(id, d);
      bodyEl.textContent = text;
      resetLink.hidden = true;
      staleHint.hidden = true;
      editLink.focus();
    }

    // same question account asks when you leave a half edited profile
    const back = () => {
      const leave = () => {
        editing = false;
        dropTyping();
        NC.router.back(receiptPath(id) + '/delete');
      };
      if (!editing || field.value().trim() === text) {
        leave();
        return;
      }
      ask({
        title: 'Discard your changes?',
        message: "What you typed here won't be saved.",
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      }).then((ok) => {
        if (ok) leave();
      });
    };

    const sendBtn = c.button('Send request', {
      icon: 'send',
      onClick: () => {
        // still typing? send what's in the box
        if (editing && !saveEdit()) return;
        sendRequest(id, d, text, sendBtn);
      },
    });

    if (d.editText != null) startEdit(d.editText, true);

    return c.screen({
      nav: c.navBar({ title: 'Delete request', back: back }),
      className: 'dr-letterpage',
      body: [
        c.title('We wrote it for you', { size: 'lg', className: 'dr-title' }),
        h('p.lead.dr-lead', 'Read it over, then send. You can change anything.'),
        raise(c.card([
          h('div.dr-meta',
            h('div.dr-meta-row', h('span.dr-k', 'To'), h('span.dr-v', contactFor(app))),
            h('div.dr-where-wrap', whereBtn, where),
            h('div.dr-meta-row', h('span.dr-k', 'Subject'), h('span.dr-v', subjectFor(d)))),
          h('div.dr-letter', bodyEl, editBox),
          staleHint,
          h('div.dr-letter-links', editLink, resetLink),
        ], { className: 'dr-letter-card' })),
      ],
      footer: sendBtn,
    });
  }

  function sendRequest(id, d, message, btn) {
    if (!NC.receipts || typeof NC.receipts.update !== 'function') {
      toast("Couldn't send it right now. Try again in a moment.", { tone: 'error' });
      return;
    }
    btn.disabled = true;
    const at = new Date().toISOString();
    const closing = d.items.indexOf('account') >= 0;
    try {
      NC.receipts.update(id, (r) => {
        r.deletion = { status: 'sent', sentAt: at, dueDays: 45, items: d.items.slice(), reason: reasonText(d), remind: true, message: message };
        (r.items || []).forEach((i) => {
          if (i.status === 'pending_delete' || gone(i)) return;
          if (d.items.indexOf(i.type) >= 0 || (closing && i.status === 'shared')) {
            // nicolas's "cancel request" puts this back
            i.prevStatus = i.status;
            i.status = 'pending_delete';
          }
        });
        r.history = Array.isArray(r.history) ? r.history : [];
        r.history.push({ id: 'h' + Date.now().toString(36) + 'd', at: at, kind: 'delete', text: 'Delete request sent' });
        return r;
      });
    } catch (e) {
      console.error('could not save the delete request', e);
      btn.disabled = false;
      toast("Couldn't send it right now. Try again in a moment.", { tone: 'error' });
      return;
    }
    clearDraft(id);
    NC.router.go(receiptPath(id) + '/delete/sent', { replace: true });
  }

  function ruleFor(app) {
    const x = RULE_FOR[app.rulesCategory];
    if (!x) return null;
    return Object.assign({
      category: app.rulesCategory,
      desc: 'Masked email and number',
      text: 'From now on, use your masked email and number for ' + x.what + '.',
    }, x);
  }

  // the softer floating shadow home uses
  function raise(el) {
    el.classList.add('card--raised');
    return el;
  }

  function closeNav(onClose) {
    return h('header.nav.dr-nav',
      h('div.nav-side', c.iconButton('x', { label: 'Close', onClick: onClose })),
      h('div.nav-title'),
      h('div.nav-side.nav-side--right'));
  }

  // sent, with  reminder switch and "make this a rule?"
  function sentScreen(params) {
    const id = params.id;
    const rec = getReceipt(id);
    if (!rec || !rec.deletion) {
      NC.router.go(rec ? receiptPath(id) : '/home', { replace: true, force: true });
      return null;
    }
    const app = appFor(rec);
    const del = rec.deletion;
    const doneUrl = receiptPath(id) + '/done';
    const remindSub = h('span.row-sub', { id: 'dr-remind-s' }, del.remind !== false ? "We'll check in on " + dueText(del) : 'No reminder set');
    const remind = c.toggle({
      id: 'dr-remind',
      checked: del.remind !== false,
      labelledBy: 'dr-remind-t',
      describedBy: 'dr-remind-s',
      onChange: (on) => {
        try {
          NC.receipts.update(id, (r) => {
            if (r.deletion) r.deletion.remind = on;
            return r;
          });
        } catch (e) {
          console.error('could not save the reminder', e);
        }
        // the line under the switch says it, a toast would only cover the close button
        remindSub.textContent = on ? "We'll check in on " + dueText(del) : 'No reminder set';
      },
    });

    const rule = NC.rules && typeof NC.rules.addCustom === 'function' ? ruleFor(app) : null;
    const have = rule && NC.rules.hasCustom && NC.rules.hasCustom(rule.id);
    let ruleCard = null;
    if (rule && !have) {
      // after task 2 the email and phone rules already mask most sign ups, so say what this one adds
      const rs = typeof NC.rules.get === 'function' ? NC.rules.get() : null;
      const on = (k) => !!(rs && typeof NC.rules.isOn === 'function' && NC.rules.isOn(rs, k));
      let already = '';
      if (on('email') && on('phone')) already = 'Your Email and Phone number rules already mask';
      else if (on('email')) already = 'Your Email rule already masks';
      else if (on('phone')) already = 'Your Phone number rule already masks';
      const cardText = already ? already + ' most sign-ups. This rule makes sure ' + rule.what + ' always gets your masked email and number.' : rule.text;
      const helpLink = NC.help && typeof NC.help.explain === 'function'
        ? h('button.link.dr-rule-help', { type: 'button', onClick: () => NC.help.explain('masking') }, NC.icon('info', { size: 18 }), 'What does masking mean?')
        : null;
      
      const add = () => {
        NC.rules.addCustom({ id: rule.id, category: rule.category, icon: rule.icon, title: rule.title, desc: rule.desc, text: rule.text });
        NC.router.go(doneUrl + '?rule=' + rule.id);
      };
      ruleCard = c.card([
        h('div.dr-rule-head', c.iconTile('sparkle', { tone: 'white', size: 44 }),
          h('div.dr-rule-text', h('h2.card-title', 'Make this a rule?'), h('p.card-text', cardText), helpLink)),
        h('div.btn-row.dr-rule-btns',
          c.button('Add rule', { onClick: add }),
          c.button('Not now', { variant: 'secondary', onClick: () => NC.router.go(doneUrl) })),
      ], { tone: 'primary-soft', className: 'dr-rule' });
    } else if (rule) {
      ruleCard = c.card(h('div.dr-rule-head', c.iconTile('check', { tone: 'white-green', size: 44 }),
        h('div.dr-rule-text', h('h2.card-title', 'Your rule is already on'),
          h('p.card-text', rule.title + ' already get your masked email and number.'))), { tone: 'green', className: 'dr-rule' });
    }

    return c.screen({
      nav: closeNav(() => popTo(receiptPath(id))),
      className: 'dr-sent',
      body: [
        h('div.dr-sent-mark', NC.icon('send', { size: 34 })),
        c.title('Request sent to ' + app.name, { size: 'lg', as: 'h1', className: 'dr-sent-title' }),
        h('p.lead.dr-sent-lead', "They usually have 45 days to reply. We'll track it in your " + app.name + ' receipt.'),
        c.card(h('div.dr-remind',
          h('span.dr-remind-icon', NC.icon('clock', { size: 22 })),
          h('div.dr-remind-text', h('span.row-title', { id: 'dr-remind-t' }, "Remind me if they don't reply"), remindSub),
          remind), { className: 'dr-remind-card' }),
        ruleCard,
      ],
      // without a rule card there still needs to be a way forward
      footer: ruleCard && !have ? null : c.button('Done', { onClick: () => NC.router.go(doneUrl) }),
    });
  }

  // take back shows up in the receipt history with what changed
  const FROM_STATUS = { masked: 'mask', off: 'off', unsubscribed: 'unsubscribe' };
  function tookBack(rec) {
    const out = [];
    const add = (type, action) => {
      if (!out.some((x) => x.type === type)) out.push({ type: type, action: action });
    };
    (rec.history || []).forEach((e) => {
      if (e && e.kind === 'take-back' && Array.isArray(e.changes)) e.changes.forEach((ch) => add(ch.type, ch.action));
    });
    if (!out.length) {
      (rec.items || []).forEach((i) => {
        const st = i.status === 'pending_delete' ? i.prevStatus : i.status;
        if (FROM_STATUS[st]) add(i.type, FROM_STATUS[st]);
      });
    }
    return out;
  }

  // says what each change did: the number was masked, not taken back
  const VERB = { off: 'turned off ', revoke: 'turned off ', mask: 'masked your ', unsubscribe: 'unsubscribed from ' };
  function tookBackLine(list) {
    const s = NC.dom.listText(list.map((x) => (VERB[x.action] || 'turned off ') + typeLabel(x.type)));
    return s[0].toUpperCase() + s.slice(1);
  }

  // things take back could still switch off. while there are some, the cleanup isnt really done
  function stillShared(rec) {
    if (!rec || !NC.receipts || typeof NC.receipts.takeBackOptions !== 'function') return [];
    try {
      return NC.receipts.takeBackOptions(rec) || [];
    } catch (e) {
      console.error('could not read what is still shared', e);
      return [];
    }
  }

  function doneTitle(app, rec) {
    return stillShared(rec).length ? 'Almost done with ' + app.name : app.name + ' cleanup done';
  }

  // new end of task 3
  function doneScreen(params, query) {
    const id = params.id;
    const rec = getReceipt(id);
    if (!rec) {
      NC.router.go('/home', { replace: true, force: true });
      return null;
    }
    const app = appFor(rec);
    const lines = [];
    const took = tookBack(rec);
    if (took.length) lines.push({ icon: 'undo', title: tookBackLine(took) });
    const del = rec.deletion;
    if (del && del.status === 'sent') {
      lines.push({
        icon: 'send',
        title: deletionLine(app, del),
        sub: del.remind !== false ? 'Reminder on ' + dueText(del) : 'They have until ' + dueText(del) + ' to reply',
      });
    }
    const ruleId = query && query.rule;
    const rule = ruleId && NC.rules && NC.rules.getCustom ? NC.rules.getCustom(ruleId) : null;
    if (rule) {
      lines.push({
        icon: rule.icon || 'rules',
        title: 'New rule: ' + rule.title.toLowerCase() + ' get your masked email and number',
        link: NC.router.has('/rules') ? h('button.link.dr-done-link', { type: 'button', onClick: () => NC.router.go('/rules?added=' + encodeURIComponent(rule.id), { transition: 'fade' }) }, 'See it in Rules', NC.icon('chev', { size: 16 })) : null,
      });
    }
    const rows = lines.map((x) => h('div.dr-done-row',
      c.iconTile('check', { tone: 'green', size: 30 }),
      h('div.dr-done-text', h('p.dr-done-line', x.title), x.sub ? h('p.dr-done-sub', x.sub) : null, x.link || null)));
    // skipped or undid take back: say what's still out there and offer the way back to it
    const left = stillShared(rec);
    if (left.length) {
      const takeUrl = receiptPath(id) + '/take-back';
      rows.push(h('div.dr-done-row.dr-done-left',
        c.iconTile('alert', { tone: 'amber', size: 30 }),
        h('div.dr-done-text',
          h('p.dr-done-line', 'Still shared: ' + NC.dom.listText(left.map((i) => typeLabel(i.type)))),
          NC.router.has(takeUrl) ? h('button.link.dr-done-link', { type: 'button', onClick: () => NC.router.go(takeUrl) }, 'Take back access', NC.icon('chev', { size: 16 })) : null)));
    }
    let lead = 'Nothing changed this time. You can come back to it any time.';
    if (lines.length) lead = left.length ? "Here's what changed so far." : "Here's everything that changed.";
    else if (left.length) lead = "Nothing changed yet. Here's what's still shared.";

    return c.screen({
      nav: closeNav(() => popTo(receiptPath(id))),
      className: 'dr-done',
      body: [
        h('div.dr-done-mark', NC.icon('check', { size: 46, stroke: 2.6 })),
        c.title(doneTitle(app, rec), { size: 'xl', as: 'h1', className: 'dr-done-title' }),
        h('p.lead.dr-done-lead', lead),
        rows.length ? c.card(rows, { className: 'dr-done-card' }) : null,
      ],
      footer: [
        c.button('Back to home', { onClick: () => popTo('/home', 'fade') }),
        c.button('View ' + app.name + ' receipt', { variant: 'secondary', onClick: () => popTo(receiptPath(id)) }),
      ],
    });
  }

  NC.router.add('/receipts/:id/delete', {
    tab: null,
    title: 'Delete request',
    render: deleteScreen,
  });

  NC.router.add('/receipts/:id/delete/review', {
    tab: null,
    title: 'Your delete request',
    render: reviewScreen,
  });

  NC.router.add('/receipts/:id/delete/sent', {
    tab: 'receipts',
    title: 'Request sent',
    render: sentScreen,
  });

  NC.router.add('/receipts/:id/done', {
    tab: 'receipts',
    title: (p) => {
      const rec = getReceipt(p.id);
      return rec ? doneTitle(appFor(rec), rec) : 'Cleanup done';
    },
    render: doneScreen,
  });

  // home: "waiting on walmart" while a delete request has no reply
  function waitingCard(r) {
    const app = appFor(r);
    const left = daysLeft(r.deletion);
    return raise(c.card(c.row({
      left: c.appTile(app, { size: 52 }),
      title: 'Waiting on ' + app.name,
      subtitle: left > 0 ? NC.dom.plural(left, 'day') + ' left to reply' : 'No reply yet. Time to follow up',
      chevron: true,
      ariaLabel: 'Waiting on ' + app.name + '. Open the receipt',
      onClick: () => NC.router.go(receiptPath(r.id)),
    }), { pad: false, className: 'dr-home-card' }));
  }

  NC.hooks.add('home-cards', () => {
    if (!NC.receipts || typeof NC.receipts.all !== 'function') return null;
    let all = [];
    try {
      all = NC.receipts.all() || [];
    } catch (e) {
      console.error('could not read receipts', e);
      return null;
    }
    return all.filter((r) => r && r.deletion && r.deletion.status === 'sent')
      .map((r, i) => ({ id: 'waiting-' + r.id, priority: 25 + i / 100, el: waitingCard(r) }));
  });
})();
