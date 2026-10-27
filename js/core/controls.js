// The shared building blocks (NC.c). Screens are put together from these so
// every part of the app looks like the same DP3 design.
(function () {
  const NC = (window.NC = window.NC || {});
  const { h } = NC.dom;

  function icon(name, size, extra) {
    return NC.icon(name, Object.assign({ size: size || 24 }, extra || {}));
  }

  function arr(v) {
    return Array.isArray(v) ? v : v == null ? [] : [v];
  }

  function screen(opts) {
    const o = opts || {};
    const footer = arr(o.footer).filter(Boolean);
    const el = h('section', {
      class: ['screen', 'screen--' + (o.tone || 'cream'), o.nav ? 'screen--nav' : null, footer.length ? 'has-footer' : null, o.className],
    });
    if (o.nav) el.appendChild(o.nav);
    // The footer lives outside the scrolling body so its buttons never scroll away
    el.appendChild(h('div.screen-body', arr(o.body)));
    if (footer.length) el.appendChild(h('div.screen-footer', footer));
    return el;
  }

  function navBar(opts) {
    const o = opts || {};
    let backBtn = null;
    if (o.back) {
      const goBack = () => {
        if (typeof o.back === 'function') o.back();
        else NC.router.back(typeof o.back === 'string' ? o.back : undefined);
      };
      backBtn = iconButton('back', { label: 'Back', onClick: goBack, variant: o.onDark ? 'onDark' : 'plain' });
      backBtn.classList.add('nav-back');
    }
    return h('header', { class: ['nav', o.onDark ? 'nav--on-dark' : null] },
      h('div.nav-side', backBtn),
      o.title ? h('h1.nav-title', o.title) : h('div.nav-title'),
      h('div.nav-side.nav-side--right', o.right || null)
    );
  }

  function title(text, opts) {
    const o = opts || {};
    const size = o.size || 'xl';
    const tag = o.as || (size === 'xl' ? 'h1' : 'h2');
    return h(tag, { class: ['title-' + size, o.className] }, text);
  }

  function button(label, opts) {
    const o = opts || {};
    const variant = o.variant || 'primary';
    return h('button', {
      type: o.type || 'button',
      id: o.id,
      class: ['btn', 'btn--' + variant, o.block === false ? null : 'btn--block', o.small ? 'btn--small' : null, o.className],
      disabled: o.disabled,
      'aria-label': o.ariaLabel,
      onClick: o.onClick,
    },
    o.icon ? icon(o.icon, o.small ? 18 : 20) : null,
    h('span.btn-label', label),
    o.iconRight ? icon(o.iconRight, o.small ? 18 : 20) : null);
  }

  function iconButton(name, opts) {
    const o = opts || {};
    const variant = o.variant === 'onDark' ? 'on-dark' : o.variant || 'plain';
    return h('button', {
      type: 'button',
      id: o.id,
      class: ['ibtn', 'ibtn--' + variant, o.className],
      'aria-label': o.label || name,
      disabled: o.disabled,
      onClick: o.onClick,
    }, icon(name, o.size || 24));
  }

  // Toggles and checkboxes share the same on/off plumbing
  function switchLike(role, opts, inner) {
    const o = opts || {};
    let on = !!o.checked;
    const el = h('button', {
      type: 'button',
      role: role,
      id: o.id,
      class: [role === 'switch' ? 'toggle' : 'checkbox', o.className],
      'aria-checked': on,
      'aria-label': o.labelledBy ? null : o.label,
      'aria-labelledby': o.labelledBy,
      'aria-describedby': o.describedBy,
      disabled: o.disabled,
    }, inner);
    el.isOn = () => on;
    el.setOn = (v, silent) => {
      const next = !!v;
      const changed = next !== on;
      on = next;
      el.setAttribute('aria-checked', String(on));
      if (changed && !silent && typeof o.onChange === 'function') o.onChange(on);
      return el;
    };
    el.addEventListener('click', () => {
      if (el.disabled) return;
      NC.dom.haptic();
      el.setOn(!on);
    });
    return el;
  }

  function toggle(opts) {
    return switchLike('switch', opts, h('span.toggle-knob'));
  }

  function checkbox(opts) {
    return switchLike('checkbox', opts, icon('check', 16, { stroke: 3 }));
  }

  // Tone 'new' is the solid red "New" chip from the updated DP3
  function chip(text, opts) {
    const o = opts || {};
    const tone = o.tone || 'gray';
    return h('span', { class: ['chip', 'chip--' + tone, o.className] },
      o.icon ? icon(o.icon, 13, { stroke: o.icon === 'check' ? 3 : 2.6 }) : null,
      h('span.chip-text', text));
  }

  const VERDICTS = {
    needed: ['Needed', 'green', 'check'],
    optional: ['Optional', 'amber', 'minus'],
    not_needed: ['Not needed', 'red', 'x'],
  };

  // Icon plus words, so a verdict never depends on color alone
  function verdict(v) {
    const d = VERDICTS[v];
    if (!d) return chip(String(v || 'Unknown'), { tone: 'gray' });
    const el = chip(d[0], { tone: d[1], icon: d[2] });
    el.classList.add('chip--verdict');
    el.dataset.verdict = v;
    return el;
  }

  // The neutral ones use the same cream as DP3's "Not shared" and "Masked now"
  const STATUSES = {
    shared: ['Shared', 'green', 'check'],
    not_shared: ['Not shared', 'cream', 'x'],
    masked: ['Masked now', 'cream', 'mask'],
    off: ['Turned off', 'green', 'check'],
    unsubscribed: ['Unsubscribed', 'green', 'check'],
    pending_delete: ['Delete requested', 'amber', 'clock'],
    deleted: ['Deleted', 'green', 'check'],
    allowed: ['Allowed', 'green', 'check'],
    declined: ['Declined', 'cream', 'x'],
  };

  function status(s) {
    const d = STATUSES[s];
    if (!d) return chip(String(s || ''), { tone: 'gray' });
    const el = chip(d[0], { tone: d[1], icon: d[2] });
    el.dataset.status = s;
    return el;
  }

  function filterChip(text, opts) {
    const o = opts || {};
    const countEl = o.count != null ? h('span.fchip-count', String(o.count)) : null;
    const el = h('button', {
      type: 'button',
      class: ['fchip', o.className],
      'aria-pressed': !!o.selected,
      onClick: o.onClick,
    }, h('span.fchip-text', text), countEl);
    // The screen decides which chip is picked, this only flips the look
    el.setSelected = (v) => el.setAttribute('aria-pressed', String(!!v));
    return el;
  }

  // Radius 13 at 44px and 16 at 60px, so it scales in between
  function appTile(app, opts) {
    const o = opts || {};
    const a = app || {};
    const size = o.size || 44;
    const radius = Math.max(6, Math.round(13 + (size - 44) * 0.1875));
    const iconName = a.icon && NC.icon.has(a.icon) ? a.icon : 'globe';
    return h('span', {
      class: ['app-tile', o.className],
      style: { width: size + 'px', height: size + 'px', borderRadius: radius + 'px', background: a.color || 'var(--ink-2)' },
      role: o.label ? 'img' : null,
      'aria-label': o.label || null,
      'aria-hidden': o.label ? null : 'true',
    }, icon(iconName, Math.round(size * 0.5)));
  }

  // Tone 'brand' is the purple NeedCheck shield tile
  function iconTile(name, opts) {
    const o = opts || {};
    const size = o.size || 40;
    return h('span', {
      class: ['itile', 'itile--' + (o.tone || 'cream'), 'itile--' + (o.shape || 'circle'), o.className],
      style: { width: size + 'px', height: size + 'px' },
      'aria-hidden': 'true',
    }, icon(name, o.iconSize || Math.round(size * 0.55)));
  }

  // A row is a button when it does something, so it never holds other buttons then
  function row(opts) {
    const o = opts || {};
    const clickable = typeof o.onClick === 'function';
    return h(clickable ? 'button' : 'div', {
      type: clickable ? 'button' : null,
      class: ['row', clickable ? 'row--tap' : null, o.subtitle && o.meta ? 'row--meta' : null, o.className],
      'aria-label': o.ariaLabel,
      onClick: o.onClick,
    },
    o.left ? h('span.row-left', o.left) : null,
    h('span.row-main',
      h('span.row-title', o.title),
      o.subtitle ? h('span.row-sub', o.subtitle) : null,
      o.meta ? h('span.row-meta', o.meta) : null),
    o.right ? h('span.row-right', o.right) : null,
    o.chevron ? icon('chev', 20, { className: 'row-chev' }) : null);
  }

  function list(rows, opts) {
    const o = opts || {};
    return h('div', { class: ['list', o.className] }, arr(rows));
  }

  function card(children, opts) {
    const o = opts || {};
    return h('div', {
      class: ['card', 'card--' + (o.tone || 'white'), o.pad === false ? null : 'card--pad', o.className],
    }, arr(children));
  }

  function section(label, children, opts) {
    const o = opts || {};
    return h('section', { class: ['section', o.className] },
      h('div.section-head', h('h2.label.section-label', label), o.action || null),
      arr(children));
  }

  function stepper(opts) {
    const o = opts || {};
    const total = o.total || 3;
    const step = Math.min(Math.max(o.step || 1, 1), total);
    const name = o.labels && o.labels[step - 1];
    const text = 'Step ' + step + ' of ' + total + (name ? ' · ' + name : '');
    // The label names the step too, an unlabeled bar was one of the DP3 complaints
    const bars = [];
    for (let i = 1; i <= total; i++) bars.push(h('span', { class: ['stepper-bar', i <= step ? 'is-done' : null] }));
    return h('div.stepper',
      h('div.stepper-bars', {
        role: 'progressbar',
        'aria-valuemin': 1,
        'aria-valuemax': total,
        'aria-valuenow': step,
        'aria-valuetext': text,
        'aria-label': 'Setup progress',
      }, bars),
      h('p.stepper-label', text));
  }

  function field(opts) {
    const o = opts || {};
    const id = o.id || NC.dom.uid('field');
    const hintId = id + '-hint';
    const errId = id + '-error';
    const input = h(o.multiline ? 'textarea' : 'input', {
      id: id,
      class: 'field-input',
      type: o.multiline ? null : o.type || 'text',
      name: o.name,
      placeholder: o.placeholder,
      autocomplete: o.autocomplete,
      inputmode: o.inputmode,
      rows: o.multiline ? o.rows || 5 : null,
      required: o.required,
      'aria-describedby': o.hint ? hintId : null,
      value: o.value,
    });
    const errText = h('span.field-error-text');
    const err = h('p.field-error', { id: errId, hidden: true }, icon('alert', 16), errText);
    let revealBtn = null;
    if (o.reveal) {
      revealBtn = iconButton('eye', { label: 'Show password', className: 'field-reveal' });
      revealBtn.setAttribute('aria-pressed', 'false');
      revealBtn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        revealBtn.setAttribute('aria-pressed', String(show));
        revealBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        revealBtn.replaceChildren(icon(show ? 'eyeOff' : 'eye', 24));
      });
    }
    const el = h('div', { class: ['field', o.reveal ? 'field--reveal' : null, o.className] },
      h('label.field-label', { for: id }, o.label),
      h('div.field-control', input, revealBtn),
      o.hint ? h('p.field-hint', { id: hintId }, o.hint) : null,
      err);

    if (typeof o.onInput === 'function') input.addEventListener('input', (e) => o.onInput(input.value, e));
    el.input = input;
    el.value = () => input.value;
    el.setValue = (v) => {
      input.value = v == null ? '' : v;
      return el;
    };
    // Errors get linked with aria-describedby so screen readers read them, not just a red border
    el.setError = (msg) => {
      const has = !!msg;
      el.classList.toggle('field--error', has);
      err.hidden = !has;
      errText.textContent = has ? msg : '';
      if (has) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      const described = [o.hint ? hintId : null, has ? errId : null].filter(Boolean).join(' ');
      if (described) input.setAttribute('aria-describedby', described);
      else input.removeAttribute('aria-describedby');
      return el;
    };
    el.focus = () => input.focus();
    return el;
  }

  function empty(opts) {
    const o = opts || {};
    return h('div.empty',
      o.icon ? iconTile(o.icon, { tone: o.tone || 'cream', size: 56 }) : null,
      o.title ? h('h2.empty-title', o.title) : null,
      o.text ? h('p.empty-text', o.text) : null,
      o.action ? h('div.empty-action', o.action) : null);
  }

  function dots(yes, total, opts) {
    const o = opts || {};
    const n = Math.max(0, total || 0);
    const y = Math.min(Math.max(0, yes || 0), n);
    const row = [];
    for (let i = 0; i < n; i++) row.push(h('span', { class: ['dot', i < y ? 'dot--yes' : 'dot--no'] }));
    const text = o.label || y + ' of ' + n + ' do this';
    return h('div.dots',
      h('div.dots-row', { 'aria-hidden': 'true' }, row),
      h('p.dots-text', text));
  }

  function banner(opts) {
    const o = opts || {};
    return h('div', { class: ['banner', 'banner--' + (o.tone || 'green'), o.title ? 'banner--titled' : null, o.className] },
      o.icon ? h('span.banner-icon', icon(o.icon, 20)) : null,
      h('div.banner-main',
        o.title ? h('p.banner-title', o.title) : null,
        o.text ? h('p.banner-text', o.text) : null),
      o.action ? h('div.banner-action', o.action) : null);
  }

  NC.c = {
    screen, navBar, title, button, iconButton, toggle, checkbox, chip, verdict, status, filterChip,
    appTile, iconTile, row, list, card, section, stepper, field, empty, dots, banner,
  };
})();
