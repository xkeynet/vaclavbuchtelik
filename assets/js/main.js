'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — MAIN
   ========================================================= */

(() => {
  const MAIN_LOGO_SRC = '/assets/vb-logo2.png';

  const MAIN_LOGO_DELAY_MS = 3000;

  let mainCreated = false;
  let mainLogoTimer = null;

  const createMain = () => {
    if (mainCreated) {
      return;
    }

    mainCreated = true;

    const main = document.createElement('section');

    main.className = 'main-view';
    main.id = 'mainView';

    main.setAttribute(
      'aria-label',
      'Václav Buchtelík main website'
    );

    const logo = document.createElement('img');

    logo.className = 'main-view__logo';
    logo.id = 'mainLogo';

    logo.src = MAIN_LOGO_SRC;
    logo.alt = 'Václav Buchtelík';

    logo.decoding = 'async';
    logo.draggable = false;

    main.appendChild(logo);

    document.body.appendChild(main);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        main.classList.add('is-visible');
      });
    });

    mainLogoTimer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          main.classList.add('is-logo-visible');
        });
      });

      mainLogoTimer = null;
    }, MAIN_LOGO_DELAY_MS);
  };

  window.addEventListener(
    'vb:main-enter',
    createMain
  );

  window.addEventListener(
    'pagehide',
    () => {
      if (mainLogoTimer !== null) {
        window.clearTimeout(mainLogoTimer);
        mainLogoTimer = null;
      }
    },
    { once: true }
  );
})();
