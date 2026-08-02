'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — INTRO
   ========================================================= */

(() => {
  /* =========================================================
     TIMING
     ========================================================= */

  const INTRO_DELAY_MS = 3000;
  const LOGO_ANIMATION_MS = 2400;
  const ENTER_START_DELAY_MS = 400;
  const ENTER_ANIMATION_MS = 1600;
  const ARROW_START_DELAY_MS = 500;

  /* =========================================================
     ELEMENTS
     ========================================================= */

  const intro = document.getElementById('intro');
  const logo = document.getElementById('introLogo');
  const gate = document.getElementById('introGate');
  const enter = document.getElementById('introEnter');
  const arrow = document.getElementById('introArrow');

  if (!intro || !logo || !gate || !enter || !arrow) {
    return;
  }

  /* =========================================================
     STATE
     ========================================================= */

  let introStarted = false;
  let enterStarted = false;
  let arrowCycleStarted = false;
  let enterActivated = false;

  let introTimer = null;
  let logoSettledTimer = null;
  let enterStartTimer = null;
  let enterSettledTimer = null;
  let arrowStartTimer = null;

  /* =========================================================
     TIMER HELPERS
     ========================================================= */

  const clearTimer = (timer) => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  };

  const clearAllTimers = () => {
    clearTimer(introTimer);
    clearTimer(logoSettledTimer);
    clearTimer(enterStartTimer);
    clearTimer(enterSettledTimer);
    clearTimer(arrowStartTimer);

    introTimer = null;
    logoSettledTimer = null;
    enterStartTimer = null;
    enterSettledTimer = null;
    arrowStartTimer = null;
  };

  /* =========================================================
     ARROW CYCLE
     ========================================================= */

  const startArrowCycle = () => {
    if (arrowCycleStarted || enterActivated) {
      return;
    }

    arrowCycleStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add('is-arrow-cycling');
      });
    });
  };

  const scheduleArrowCycle = () => {
    arrowStartTimer = window.setTimeout(
      startArrowCycle,
      ARROW_START_DELAY_MS
    );
  };

  /* =========================================================
     ENTER
     ========================================================= */

  const settleEnter = () => {
    intro.classList.add('is-enter-settled');
    scheduleArrowCycle();
  };

  const showEnter = () => {
    if (enterStarted || enterActivated) {
      return;
    }

    enterStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add('is-enter-visible');

        enterSettledTimer = window.setTimeout(
          settleEnter,
          ENTER_ANIMATION_MS
        );
      });
    });
  };

  const scheduleEnter = () => {
    enterStartTimer = window.setTimeout(
      showEnter,
      ENTER_START_DELAY_MS
    );
  };

  /* =========================================================
     LOGO
     ========================================================= */

  const settleLogo = () => {
    intro.classList.add('is-logo-settled');
    scheduleEnter();
  };

  const startIntro = () => {
    if (introStarted || enterActivated) {
      return;
    }

    introStarted = true;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        intro.classList.add('is-logo-visible');

        logoSettledTimer = window.setTimeout(
          settleLogo,
          LOGO_ANIMATION_MS
        );
      });
    });
  };

  const scheduleIntro = () => {
    introTimer = window.setTimeout(
      startIntro,
      INTRO_DELAY_MS
    );
  };

  /* =========================================================
     ENTER ACTIVATION
     ========================================================= */

  const activateEnter = () => {
    if (enterActivated) {
      return;
    }

    enterActivated = true;

    clearAllTimers();

    intro.classList.remove('is-arrow-cycling');
    intro.classList.add('is-enter-activated');

    /*
     * Přechod na další obsah webu doplníme v následujícím kroku.
     * Tlačítko je nyní plně připravené pro navazující animaci
     * nebo otevření hlavní stránky.
     */
  };

  enter.addEventListener('click', activateEnter);

  /* =========================================================
     ASSET ERROR HANDLING
     ========================================================= */

  const handleLogoError = () => {
    clearTimer(introTimer);
    clearTimer(logoSettledTimer);

    introStarted = true;

    intro.classList.add(
      'is-logo-visible',
      'is-logo-settled'
    );

    scheduleEnter();
  };

  logo.addEventListener(
    'error',
    handleLogoError,
    { once: true }
  );

  /* =========================================================
     START
     ========================================================= */

  scheduleIntro();

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      clearAllTimers();
    },
    { once: true }
  );
})();
