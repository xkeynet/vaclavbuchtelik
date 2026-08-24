'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — MAIN
   ========================================================= */

(() => {
  const MAIN_LOGO_SRC = '/assets/vb-logo2.png';

  let mainCreated = false;

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
  };

  window.addEventListener(
    'vb:main-enter',
    createMain
  );
})();
