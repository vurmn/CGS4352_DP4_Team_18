// Small DOM and date helpers everyone uses, plus the hook registry that lets
// features add cards and badges to each other without importing anything.
(function () {
  const NC = (window.NC = window.NC || {});

  const BOOL_PROPS = ['disabled', 'checked', 'hidden', 'selected', 'autofocus', 'required', 'readOnly', 'multiple', 'open'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_MS = 86400000;

  function isAttrs(v) {
    return v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Node);
  }

  function append(el, kids) {
    kids.forEach((k) => {
      if (k == null || k === false || k === true) return;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(document.createTextNode(String(k)));
    });
    return el;
  }

  // Tags look like 'div.card.card--peach' or 'button#save.btn'
  function h(tag, attrs, ...children) {
    const parts = String(tag || 'div').split(/(?=[.#])/);
    const el = document.createElement(parts[0] && !/^[.#]/.test(parts[0]) ? parts.shift() : 'div');
    parts.forEach((p) => {
      if (p[0] === '.') el.classList.add(p.slice(1));
      else if (p[0] === '#') el.id = p.slice(1);
    });
    if (!isAttrs(attrs)) {
      children.unshift(attrs);
      attrs = null;
    }
    if (attrs) setAttrs(el, attrs);
    return append(el, children);
  }

  function setAttrs(el, attrs) {
    Object.keys(attrs).forEach((key) => {
      const v = attrs[key];
      if (key === 'class' || key === 'className') {
        const list = Array.isArray(v) ? v : String(v || '').split(/\s+/);
        list.filter(Boolean).forEach((c) => el.classList.add(c));
      } else if (key === 'style') {
        if (typeof v === 'string') el.style.cssText += ';' + v;
        else if (v) {
          Object.keys(v).forEach((k) => {
            if (v[k] == null) return;
            if (k.startsWith('--')) el.style.setProperty(k, v[k]);
            else el.style[k] = v[k];
          });
        }
      } else if (/^on[A-Z]/.test(key) && typeof v === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), v);
      } else if (BOOL_PROPS.includes(key)) {
        if (v) el[key] = true;
      } else if (key === 'value') {
        if (v != null) el.value = v;
      } else if (/^(aria|data)-/.test(key)) {
        // Booleans become strings here, since aria-pressed="false" has to be written out
        if (v != null) el.setAttribute(key, String(v));
      } else if (v != null && v !== false) {
        el.setAttribute(key, v === true ? '' : String(v));
      }
    });
  }

  function frag(...children) {
    return append(document.createDocumentFragment(), children);
  }

  function clear(el) {
    if (el) while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function appRoot() {
    return document.getElementById('app') || document.querySelector('.app') || document.body;
  }

  function toDate(d) {
    if (d instanceof Date) return new Date(d.getTime());
    if (d == null) return new Date();
    return new Date(d);
  }

  function startOfDay(d) {
    const x = toDate(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function today() {
    return new Date();
  }

  // Using setDate keeps the clock time even across a daylight saving change
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - (Number(n) || 0));
    return d;
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
  }

  function fmtDate(value, style) {
    const d = toDate(value);
    if (isNaN(d)) return '';
    const mon = MONTHS[d.getMonth()];
    const short = mon.slice(0, 3) + ' ' + d.getDate();
    switch (style) {
      case 'long':
        return mon + ' ' + d.getDate() + ', ' + d.getFullYear();
      case 'month':
        return mon;
      case 'time': {
        const hr = d.getHours() % 12 || 12;
        return hr + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
      }
      case 'day': {
        const diff = daysBetween(d, new Date());
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        return d.getFullYear() === new Date().getFullYear() ? short : short + ', ' + d.getFullYear();
      }
      default:
        return short;
    }
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many || one + 's');
  }

  function listText(arr) {
    const a = (arr || []).filter((x) => x != null && x !== '');
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  let uidCount = 0;
  function uid(prefix) {
    uidCount += 1;
    return (prefix || 'nc') + '-' + uidCount + Math.random().toString(36).slice(2, 6);
  }

  function haptic(ms) {
    if (!navigator.vibrate) return;
    // Chrome complains if we vibrate before the first real tap
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try {
      const s = NC.store && NC.store.settings ? NC.store.settings() : null;
      if (s && s.haptics === false) return;
      navigator.vibrate(ms == null ? 10 : ms);
    } catch (e) {
      // Vibration is a nice extra, never worth breaking a tap over
    }
  }

  function greeting() {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return 'Good morning';
    if (hr >= 12 && hr < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function initials(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  // The phone setting or our own Reduce motion switch, either one turns animation off
  function reducedMotion() {
    if (document.documentElement.classList.contains('reduce-motion')) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // On desktop the phone frame is scaled down to fit, so drags divide by this to get phone pixels
  function frameScale() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--frame-scale')) || 1;
  }

  NC.dom = { h, frag, clear, appRoot, today, daysAgo, daysBetween, fmtDate, plural, listText, uid, haptic, greeting, initials, reducedMotion, frameScale };

  // Hooks are how one feature shows up inside another one's screen.
  const hooks = {};

  function add(name, fn) {
    if (typeof fn !== 'function') return () => {};
    (hooks[name] = hooks[name] || []).push(fn);
    return () => {
      hooks[name] = (hooks[name] || []).filter((f) => f !== fn);
    };
  }

  function list(name) {
    return (hooks[name] || []).slice();
  }

  function flat(v, out) {
    if (Array.isArray(v)) v.forEach((x) => flat(x, out));
    else if (v != null) out.push(v);
    return out;
  }

  // One broken hook should never blank the whole screen
  function collect(name, ...args) {
    const out = [];
    list(name).forEach((fn) => {
      try {
        flat(fn(...args), out);
      } catch (e) {
        console.error('hook "' + name + '" failed:', e);
      }
    });
    return out;
  }

  NC.hooks = { add, list, collect };
})();
