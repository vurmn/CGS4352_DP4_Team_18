// Boots the app once every other script has registered its routes and tabs.
// Also runs the desktop extras: fake status bar clock, phone frame scaling.
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
