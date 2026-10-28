// pop-ups for the whole app: toasts, bottom sheets and the confirm dialog.
// everything mounts inside the .app element so on desktop it all stays inside the phone frame.
(function () {
  const NC = (window.NC = window.NC || {});
  // dom.js ships before us in danyal's push, so without it there's nothing to build with
  if (!NC.dom || !NC.dom.h) return;

  const { h, frag, uid } = NC.dom;
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function icon(name, size) {
    return NC.icon && name ? NC.icon(name, { size }) : null;
  }

  function button(label, variant, onClick, extraClass) {
    const b = NC.c && NC.c.button
      ? NC.c.button(label, { variant, onClick })
      : h('button.btn.btn--' + variant + '.btn--block', { type: 'button', onClick }, label);
    if (extraClass) b.classList.add(extraClass);
    return b;
  }

  // dom.js has the one reduce motion check every file shares
  function later(ms, fn) {
    const still = NC.dom.reducedMotion && NC.dom.reducedMotion();
    return setTimeout(fn, still ? 0 : ms);
  }

  // the layer that holds every overlay

  let root = null;
  let toastRegion = null;

  function appRoot() {
    return NC.dom.appRoot() || document.querySelector('.app') || document.body;
  }

  function layerRoot() {
    const app = appRoot();
    if (!root) {
      root = h('div.overlays');
      toastRegion = h('div.toast-region', { 'aria-live': 'polite', 'aria-relevant': 'additions' });
      root.appendChild(toastRegion);
    }
    if (root.parentNode !== app) {
      // absolute children need a positioned parent, but don't fight whatever base.css picked
      if (app !== document.body && getComputedStyle(app).position === 'static') app.style.position = 'relative';
      app.appendChild(root);
    }
    return root;
  }

  // toasts

  let currentToast = null;
  // taps and key presses, so we can tell a screen change someone asked for from the one
  // a feature makes right after its toast (like going back to the receipt after take back)
  let inputs = 0;
  document.addEventListener('pointerdown', () => { inputs += 1; }, true);
  document.addEventListener('keydown', () => { inputs += 1; }, true);

  function routePath() {
    const p = String(location.hash || '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
    return p || '/';
  }

  const TAPPABLE = 'button, a[href], input, [role="button"], [role="switch"], [role="checkbox"]';

  // where the toast goes. with a nav bar it sits right under it (like the DP3 Walmart receipt), so back and the
  // title stay visible. a toast on top of a button just eats the first tap
  function placeToasts(instant) {
    if (!toastRegion || !currentToast) return;
    const screen = document.querySelector('#view > .screen:last-child');
    let top = 0;
    if (screen && screen.offsetHeight) {
      const box = screen.getBoundingClientRect();
      // the desktop frame is scaled, so turn page pixels back into app pixels
      const k = box.height / screen.offsetHeight || 1;
      const edges = (el) => {
        const r = el.getBoundingClientRect();
        return { top: (r.top - box.top) / k, bottom: (r.bottom - box.top) / k, w: r.width, tap: el.tagName !== 'H1' };
      };
      const nav = screen.querySelector(':scope > .nav');
      top = nav && nav.offsetHeight ? edges(nav).bottom + 4 : clearSpot(screen, edges);
    }
    // a fresh toast just appears in its spot, one that's already up slides along with the screen
    toastRegion.classList.toggle('no-slide', !!instant);
    if (top) toastRegion.style.setProperty('--toast-top', Math.round(top) + 'px');
    else toastRegion.style.removeProperty('--toast-top');
    if (instant) void toastRegion.offsetHeight;
    toastRegion.classList.remove('no-slide');
  }

  // no nav bar (Home and the tab tops): if the big title or a button like the Home avatar is
  // at the top, go just under it, unless that spot sits on another button. a covered title
  // for a few seconds beats a covered button. 0 means the usual spot at the top
  function clearSpot(screen, edges) {
    const safe = parseFloat(getComputedStyle(screen).paddingTop) || 0;
    const tall = currentToast.el.offsetHeight;
    const items = Array.from(screen.querySelectorAll('h1, ' + TAPPABLE))
      .filter((el) => !el.closest('[aria-hidden="true"]'))
      .map(edges)
      .filter((e) => e.w && e.bottom > safe);
    const hit = items.filter((e) => e.top < safe + 8 + tall);
    if (!hit.length) return 0;
    const under = Math.max(...hit.map((e) => e.bottom)) + 4;
    if (under > safe + 160) return 0;
    const blocked = items.some((e) => e.tap && (e.top + e.bottom) / 2 > under && (e.top + e.bottom) / 2 < under + tall);
    return !blocked || hit.some((e) => e.tap) ? under : 0;
  }

  // a toast is about the screen it showed up on. when someone opens a screen inside that one
  // (receipt -> delete request) it goes, so its Undo can't change things behind their back.
  // going home or back up keeps it, so Undo still works from there
  function toastFollows() {
    const t = currentToast;
    if (!t) return;
    const path = routePath();
    if (path === t.path) return;
    if (t.inputs !== inputs && path.indexOf(t.path === '/' ? '/' : t.path + '/') === 0) {
      t.close();
      return;
    }
    t.path = path;
  }

  function toast(message, opts) {
    const o = opts || {};
    const tone = ['success', 'info', 'error'].indexOf(o.tone) >= 0 ? o.tone : 'success';
    const iconName = o.icon === false ? null : o.icon || { success: 'check', error: 'alert', info: null }[tone];
    const duration = o.duration != null ? o.duration : o.action ? 6000 : 3500;

    if (currentToast) currentToast.close(true);
    layerRoot();

    let closed = false;
    let timer = null;
    let remaining = duration;
    let startedAt = 0;
    let hovered = false;
    let focused = false;

    const action = o.action
      ? h('button.toast__action', {
        type: 'button',
        onClick: (e) => {
          e.stopPropagation();
          close();
          try {
            if (o.action.onClick) o.action.onClick();
          } catch (err) {
            console.error(err);
          }
        },
      }, o.action.label || 'Undo')
      : null;

    const el = h('div.toast.toast--' + tone, { class: action ? 'toast--has-action' : null },
      iconName ? h('span.toast__icon', {}, icon(iconName, 20)) : null,
      h('div.toast__msg', {}, message),
      action);

    // tapping the toast itself just sends it away
    el.addEventListener('click', () => close());
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovered = true;
      pause();
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovered = false;
      run();
    });
    el.addEventListener('focusin', () => {
      focused = true;
      pause();
    });
    el.addEventListener('focusout', (e) => {
      if (el.contains(e.relatedTarget)) return;
      focused = false;
      run();
    });

    function run() {
      if (closed || timer || hovered || focused || !duration || duration === Infinity) return;
      startedAt = Date.now();
      timer = setTimeout(close, remaining);
    }

    function pause() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      // give people a moment after they move away, even if the time had nearly run out
      remaining = Math.max(1500, remaining - (Date.now() - startedAt));
    }

    function close(now) {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (currentToast === api) currentToast = null;
      el.classList.remove('is-in');
      el.classList.add('is-out');
      if (now === true) el.remove();
      else later(220, () => el.remove());
    }

    const api = { el, close: (now) => close(now), path: routePath(), inputs };
    currentToast = api;
    toastRegion.appendChild(el);
    placeToasts(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!closed) el.classList.add('is-in');
    }));
    run();
    return { el, close: () => close() };
  }

  // modal layers (sheets and confirms share one stack)

  const stack = [];
  let inerted = [];

  // a double tap is two clicks. if the first one opens or closes a sheet, the second lands on
  // whatever is under the finger now (the backdrop, or the screen behind a sheet that's still
  // sliding away), so real taps that come right after a layer moves are dropped
  let quietUntil = 0;
  document.addEventListener('click', (e) => {
    if (e.isTrusted && Date.now() < quietUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  function lockBackground() {
    const app = appRoot();
    inerted = Array.from(app.children).filter((c) => c !== root && !c.hasAttribute('inert'));
    inerted.forEach((c) => c.setAttribute('inert', ''));
  }

  function unlockBackground() {
    inerted.forEach((c) => c.removeAttribute('inert'));
    inerted = [];
  }

  function syncInert() {
    stack.forEach((l, i) => {
      const under = i < stack.length - 1;
      l.wrap.toggleAttribute('inert', under);
      l.wrap.classList.toggle('is-under', under);
    });
  }

  function pushLayer(layer) {
    quietUntil = Date.now() + 350;
    layer.returnTo = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    layer.hash = location.hash;
    layerRoot();
    if (!stack.length) lockBackground();
    stack.push(layer);
    layer.wrap.style.zIndex = String(10 + stack.length * 2);
    layer.wrap.classList.toggle('is-stacked', stack.length > 1);
    root.appendChild(layer.wrap);
    syncInert();
    // force a style pass so the slide in actually animates
    void layer.wrap.offsetHeight;
    requestAnimationFrame(() => layer.wrap.classList.add('is-open'));
    const target = layer.focusEl ? layer.focusEl() : layer.panel;
    if (target) target.focus({ preventScroll: true });
  }

  function popLayer(layer) {
    const i = stack.indexOf(layer);
    if (i < 0) return false;
    quietUntil = Date.now() + 350;
    const wasTop = i === stack.length - 1;
    stack.splice(i, 1);
    layer.wrap.classList.remove('is-open');
    layer.wrap.classList.add('is-closing');
    layer.wrap.setAttribute('inert', '');
    later(layer.outMs || 260, () => layer.wrap.remove());
    syncInert();
    if (!stack.length) unlockBackground();
    if (wasTop) {
      let back = layer.returnTo;
      // a live screen may have redrawn under the sheet, so look for the same button again
      if (back && !back.isConnected && back.id) back = document.getElementById(back.id);
      // still gone? the screen heading the router focuses is the next best spot
      if (!stack.length && (!back || !back.isConnected)) {
        back = document.querySelector('#view .screen:last-child h1');
        if (back && !back.hasAttribute('tabindex')) back.setAttribute('tabindex', '-1');
      }
      if (back && back.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true });
      else if (stack.length) stack[stack.length - 1].panel.focus({ preventScroll: true });
    }
    return true;
  }

  function topLayer() {
    return stack[stack.length - 1] || null;
  }

  document.addEventListener('keydown', (e) => {
    const top = topLayer();
    if (!top) return;
    if (e.key === 'Escape') {
      if (!top.dismissible) return;
      e.preventDefault();
      top.dismiss('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    // keep tab inside the open sheet or dialog
    const items = Array.from(top.panel.querySelectorAll(FOCUSABLE)).filter((x) => x.offsetWidth || x.offsetHeight);
    if (!items.length) {
      e.preventDefault();
      top.panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !top.panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !top.panel.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('focusin', (e) => {
    const top = topLayer();
    if (!top || !root) return;
    const t = e.target;
    const app = appRoot();
    // the desktop side panel lives outside the phone, so it can keep focus
    if (!app.contains(t) || top.panel.contains(t) || toastRegion.contains(t)) return;
    top.panel.focus({ preventScroll: true });
  });

  // a sheet that belongs to the old screen should not hang around after the route changes.
  // a sheet opened right after navigating already has the new hash, so it stays
  function closeStale() {
    stack.slice().reverse().forEach((l) => {
      if (l.hash !== location.hash) l.dismiss('route', true);
    });
    if (root && !root.isConnected) layerRoot();
  }
  window.addEventListener('hashchange', closeStale);
  window.addEventListener('popstate', closeStale);

  // bottom sheets

  function sheet(opts) {
    const o = opts || {};
    const dismissible = o.dismissible !== false;
    const titleId = uid('sheet-title');
    let closed = false;

    const api = {
      el: null,
      body: null,
      close: (reason) => close(typeof reason === 'string' ? reason : 'api', true),
    };

    const closeBtn = o.title && dismissible
      ? h('button.sheet__close', { type: 'button', 'aria-label': 'Close', onClick: () => close('button') }, icon('x', 20))
      : null;
    const head = o.title
      ? h('div.sheet__head', {}, h('h2.sheet__title', { id: titleId }, o.title), closeBtn)
      : null;
    const grab = h('div.sheet__grab', { 'aria-hidden': 'true' }, h('span.sheet__grabber'));
    const body = h('div.sheet__body');
    const panel = h('div.sheet', {
      role: 'dialog',
      'aria-modal': 'true',
      tabindex: '-1',
      class: [o.className, o.tall ? 'sheet--tall' : null, head ? 'sheet--titled' : null],
    }, grab, head, body);
    api.el = panel;
    api.body = body;

    body.appendChild(frag(typeof o.body === 'function' ? o.body(api) : o.body));
    if (o.footer) {
      const foot = typeof o.footer === 'function' ? o.footer(api) : o.footer;
      panel.appendChild(h('div.sheet__foot', {}, foot));
    }

    if (o.title) panel.setAttribute('aria-labelledby', titleId);
    else if (o.label) panel.setAttribute('aria-label', o.label);
    else {
      const heading = body.querySelector('h1, h2, h3');
      if (heading) {
        if (!heading.id) heading.id = titleId;
        panel.setAttribute('aria-labelledby', heading.id);
      } else {
        panel.setAttribute('aria-label', 'Details');
      }
    }

    const backdrop = h('div.sheet-backdrop', {
      'aria-hidden': 'true',
      onClick: () => {
        if (dismissible) close('backdrop');
      },
    });
    const wrap = h('div.sheet-layer', {}, backdrop, panel);

    function close(reason, force) {
      if (closed || (!dismissible && !force)) return;
      closed = true;
      popLayer(layer);
      if (o.onClose) {
        try {
          o.onClose(reason);
        } catch (e) {
          console.error(e);
        }
      }
    }

    const layer = {
      wrap,
      panel,
      dismissible,
      dismiss: (reason, force) => close(reason, force),
      focusEl: () => panel.querySelector('[autofocus]') || panel,
      outMs: 260,
    };

    if (dismissible) enableSwipe(panel, body, [grab, head], () => close('swipe'));
    pushLayer(layer);
    // only draw the line above the footer when the body really scrolls under it
    const checkScroll = () => panel.classList.toggle('sheet--scrolls', body.scrollHeight > body.clientHeight + 1);
    requestAnimationFrame(checkScroll);
    if (window.ResizeObserver) new ResizeObserver(checkScroll).observe(body);
    return api;
  }

  // swipe down to close. the grabber and title row drag right away, the body
  // only drags when it is already scrolled to the top (otherwise it just scrolls)
  function enableSwipe(panel, body, handles, onClose) {
    let drag = null;

    function start(y) {
      // on desktop the phone frame is scaled down, so screen pixels and app pixels differ
      const k = (NC.dom.frameScale && NC.dom.frameScale()) || 1;
      drag = { y0: y, dy: 0, t0: Date.now(), k };
      panel.classList.add('is-dragging');
    }
    function move(y) {
      drag.dy = Math.max(0, (y - drag.y0) / drag.k);
      panel.style.transform = 'translateY(' + drag.dy + 'px)';
    }
    function end() {
      if (!drag) return;
      const d = drag;
      drag = null;
      panel.classList.remove('is-dragging');
      panel.style.transform = '';
      const speed = d.dy / Math.max(1, Date.now() - d.t0);
      if (d.dy > Math.min(120, panel.offsetHeight * 0.3) || (d.dy > 40 && speed > 0.6)) onClose();
    }

    handles.filter(Boolean).forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || e.target.closest('button, a, input, textarea, select')) return;
        el.setPointerCapture(e.pointerId);
        start(e.clientY);
      });
      el.addEventListener('pointermove', (e) => {
        if (drag) move(e.clientY);
      });
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });

    let maybe = null;
    body.addEventListener('touchstart', (e) => {
      maybe = body.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null;
    }, { passive: true });
    body.addEventListener('touchmove', (e) => {
      if (maybe == null) return;
      const y = e.touches[0].clientY;
      if (!drag) {
        if (y - maybe < -4) maybe = null;
        else if (y - maybe > 8 && body.scrollTop <= 0) start(maybe);
      }
      if (drag) {
        e.preventDefault();
        move(y);
      }
    }, { passive: false });
    body.addEventListener('touchend', () => {
      maybe = null;
      end();
    });
    body.addEventListener('touchcancel', () => {
      maybe = null;
      end();
    });
  }

  // confirm dialog

  function confirm(opts) {
    const o = opts || {};
    const okLabel = o.confirmLabel || 'OK';
    const cancelLabel = o.cancelLabel || 'Cancel';
    // long labels don't fit side by side in the card, so stack them
    const stacked = Math.max(okLabel.length, cancelLabel.length) > 11;

    return new Promise((resolve) => {
      let done = false;
      const titleId = uid('confirm-title');
      const msgId = uid('confirm-msg');

      function finish(value) {
        if (done) return;
        done = true;
        popLayer(layer);
        resolve(value);
      }

      const cancelBtn = button(cancelLabel, 'secondary', () => finish(false), 'confirm__cancel');
      const okBtn = button(okLabel, o.danger ? 'danger' : 'primary', () => finish(true), o.danger ? 'confirm__ok--danger' : 'confirm__ok');
      const card = h('div.confirm', {
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        'aria-describedby': o.message ? msgId : null,
        tabindex: '-1',
        class: [o.danger ? 'confirm--danger' : null, stacked ? 'confirm--stack' : null],
      },
      o.icon ? h('div.confirm__icon', { 'aria-hidden': 'true' }, icon(o.icon, 24)) : null,
      h('h2.confirm__title', { id: titleId }, o.title || 'Are you sure?'),
      o.message ? h('p.confirm__msg', { id: msgId }, o.message) : null,
      h('div.confirm__actions', {}, stacked ? [okBtn, cancelBtn] : [cancelBtn, okBtn]));

      const wrap = h('div.confirm-layer', {},
        h('div.confirm-backdrop', { 'aria-hidden': 'true', onClick: () => finish(false) }),
        card);

      const layer = {
        wrap,
        panel: card,
        dismissible: true,
        dismiss: () => finish(false),
        // cancel is always the safe choice, so that is where focus starts
        focusEl: () => cancelBtn,
        outMs: 200,
      };
      pushLayer(layer);
    });
  }

  function closeAll() {
    stack.slice().reverse().forEach((l) => l.dismiss('api', true));
    if (currentToast) currentToast.close(true);
  }

  NC.ui = { toast, sheet, confirm, closeAll };

  // make the live region early so the first toast gets read out too. the router moves
  // with pushState (no hashchange), so we also listen to it directly
  let primed = false;
  function prime() {
    if (primed) return;
    primed = true;
    if (document.querySelector('.app')) layerRoot();
    if (NC.router && NC.router.onChange) {
      NC.router.onChange(() => {
        closeStale();
        toastFollows();
        placeToasts();
      });
    }
    // reset demo data swaps everything underneath, so open pop-ups would be out of date
    if (NC.hooks && NC.hooks.add) NC.hooks.add('data-reset', () => stack.slice().reverse().forEach((l) => l.dismiss('reset', true)));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prime);
  else prime();
})();
