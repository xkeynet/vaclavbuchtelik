'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — INTRO
   ========================================================= */

(() => {
  const INTRO_DELAY_MS = 3000;
  const LOGO_ANIMATION_MS = 2400;

  const intro = document.getElementById('intro');
  const logo = document.getElementById('introLogo');

  if (!intro || !logo) {
    return;
  }

  let introStarted = false;
  let introTimer = null;
  let settledTimer = null;

  /**
   * Aktivuje příjezd loga.
   */
  const startIntro = () => {
    if (introStarted) {
      return;
    }

    introStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add('is-logo-visible');

        settledTimer = window.setTimeout(() => {
          intro.classList.add('is-logo-settled');
        }, LOGO_ANIMATION_MS);
      });
    });
  };

  /**
   * Spustí třísekundovou designovou prodlevu.
   */
  const scheduleIntro = () => {
    introTimer = window.setTimeout(startIntro, INTRO_DELAY_MS);
  };

  /**
   * Zajistí, že rozbitý obrázek nezůstane skrytý bez informace.
   */
  const handleLogoError = () => {
    window.clearTimeout(introTimer);
    window.clearTimeout(settledTimer);

    intro.classList.add('is-logo-visible', 'is-logo-settled');
  };

  logo.addEventListener('error', handleLogoError, { once: true });

  /**
   * Začátek odpočtu po připravení DOM.
   * Logo je v HTML preloadováno s vysokou prioritou.
   */
  scheduleIntro();

  /**
   * Úklid timerů při opuštění dokumentu.
   */
  window.addEventListener(
    'pagehide',
    () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(settledTimer);
    },
    { once: true }
  );
})();
