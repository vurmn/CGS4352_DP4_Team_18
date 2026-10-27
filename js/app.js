// Boots the app once every other script has registered its routes and tabs.
// Also runs the desktop extras: fake status bar clock, side panel, phone frame scaling.
(function () {
  const NC = (window.NC = window.NC || {});
  const { h } = NC.dom;

  // Keep this in sync with the desktop media query in base.css
  const DESKTOP_MQ = '(min-width: 761px) and (min-height: 560px)';
  const FRAME = { h: 868, gap: 16 };

  // Chrome logs a CORS error for the manifest on file://, and it only matters once hosted anyway
  if (location.protocol === 'file:') {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.remove();
  }

  function startClock() {
    const el = document.querySelector('.statusbar-time');
    if (!el) return;
    const tick = () => {
      const d = new Date();
      el.textContent = (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    tick();
    // Line up with the start of the next minute, then tick once a minute
    setTimeout(() => {
      tick();
      setInterval(tick, 60000);
    }, 60000 - (Date.now() % 60000) + 50);
  }

  function shareUrl() {
    return location.href.split('#')[0];
  }

  // The QR library loads async so a slow or blocked CDN never holds up the app. Draw it whenever it shows up
  function qrBox() {
    const box = h('div.side-qr', { role: 'img', 'aria-label': 'QR code that opens this app on your phone', hidden: true });
    const draw = () => {
      if (typeof window.QRCode !== 'function' || !box.hidden) return;
      try {
        // Drawn at 2x and shown at half size so it stays sharp
        new window.QRCode(box, {
          text: shareUrl(),
          width: 296,
          height: 296,
          colorDark: '#1C1C1C',
          colorLight: '#FFFFFF',
          correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : undefined,
        });
        box.removeAttribute('title');
        box.hidden = false;
      } catch (e) {
        console.error('QR code failed:', e);
      }
    };
    const lib = document.getElementById('qr-lib');
    if (typeof window.QRCode === 'function') draw();
    else if (lib) lib.addEventListener('load', draw);
    else return null;
    return box;
  }

  function resetButton() {
    const canReset = NC.store && typeof NC.store.resetData === 'function' && NC.ui && typeof NC.ui.confirm === 'function';
    if (!canReset) return null;
    return NC.c.button('Reset demo data', {
      variant: 'secondary',
      icon: 'refresh',
      small: true,
      block: false,
      className: 'side-reset',
      onClick: onReset,
    });
  }

  function onReset() {
    if (NC.store.currentUser && !NC.store.currentUser()) {
      if (NC.ui.toast) NC.ui.toast('Log in first, then reset the demo', { tone: 'info' });
      return;
    }
    // Close whatever is already open (say a Log out confirm) so two dialogs never stack
    if (typeof NC.ui.closeAll === 'function') NC.ui.closeAll();
    NC.ui.confirm({
      title: 'Reset demo data?',
      message: 'Every request, rule and receipt goes back to how the demo starts. Your account stays.',
      confirmLabel: 'Reset',
      danger: true,
      icon: 'refresh',
    }).then((ok) => {
      if (!ok) return;
      NC.store.resetData();
      // Land on the top of whatever tab you were in, since the screen you had may be gone now
      const cur = NC.router.current();
      const tab = cur && cur.def && cur.def.tab ? '/' + cur.def.tab : '/home';
      NC.router.go(NC.router.has(tab) ? tab : '/home', { replace: true, transition: 'fade', force: true });
      if (NC.ui.toast) NC.ui.toast('Demo data is back to the start', { tone: 'success', icon: 'check' });
    });
  }

  function buildSide() {
    const side = document.querySelector('.side');
    if (!side) return;
    const qr = qrBox();
    const onDisk = location.protocol === 'file:';
    NC.dom.clear(side).appendChild(h('div.side-inner',
      h('div.side-brand',
        h('span.app-mark', NC.icon('shield', { size: 26 })),
        h('span.side-name', 'NeedCheck')),
      h('p.side-desc', 'Check what apps ask for, set your privacy rules once, and keep receipts of everything you shared.'),
      h('div.side-card',
        h('p.side-card-title', 'Best on a phone. Scan to open it there.'),
        qr,
        onDisk ? h('p.side-note', 'The code works once the app is hosted online.') : h('p.side-note.side-url', shareUrl().replace(/^https?:\/\//, ''))),
      resetButton()));
    side.hidden = false;
  }

  // Shrink the phone to fit short laptop screens, never grow it past real size
  function fitFrame() {
    const html = document.documentElement;
    if (!window.matchMedia(DESKTOP_MQ).matches) {
      html.style.removeProperty('--frame-scale');
      return;
    }
    const scale = Math.min(1, Math.max(0.5, (window.innerHeight - FRAME.gap * 2) / FRAME.h));
    html.style.setProperty('--frame-scale', scale.toFixed(4));
  }

  function boot() {
    // Text size and Reduce motion for the first screen. The store keeps them up to date after that
    if (NC.store && typeof NC.store.applySettings === 'function') NC.store.applySettings();
    startClock();
    buildSide();
    fitFrame();
    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitFrame);
    });
    NC.router.start();
  }

  let booted = false;
  const bootOnce = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.readyState === 'complete') bootOnce();
  else {
    document.addEventListener('DOMContentLoaded', bootOnce);
    window.addEventListener('load', bootOnce);
  }
})();
