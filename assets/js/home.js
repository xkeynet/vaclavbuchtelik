'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — HOME
   ========================================================= */

(() => {
  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const DIVIDER_LOGO_GAP_PX = 8;

  /* =========================================================
     STATE
     ========================================================= */

  let homeCreated = false;
  let dividerVisible = false;

  let mainView = null;
  let homeView = null;
  let divider = null;

  let mainObserver = null;
  let controlsObserver = null;
  let menuStateObserver = null;
  let layoutObserver = null;

  let syncFrame = null;

  /* =========================================================
     ELEMENT HELPERS
     ========================================================= */

  const createElement = (
    tagName,
    className = ''
  ) => {
    const element =
      document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    return element;
  };

  /* =========================================================
     MAIN STATE
     ========================================================= */

  const isMenuOpen = () => {
    return Boolean(
      mainView &&
      mainView.classList.contains(
        'is-menu-visible'
      )
    );
  };

  /* =========================================================
     CLOSED DIVIDER POSITION
     Pod skutečným spodkem loga.
     ========================================================= */

  const getClosedDividerY = () => {
    if (!mainView) {
      return 0;
    }

    const logo =
      mainView.querySelector(
        '.main-view__logo'
      );

    if (!logo) {
      return 0;
    }

    const mainRect =
      mainView.getBoundingClientRect();

    const logoRect =
      logo.getBoundingClientRect();

    return (
      logoRect.bottom -
      mainRect.top +
      DIVIDER_LOGO_GAP_PX
    );
  };

  /* =========================================================
     OPEN DIVIDER POSITION
     Přesná pozice původního MAIN divideru pod menu.
     ========================================================= */

  const getOpenDividerY = () => {
    if (!mainView) {
      return 0;
    }

    const originalDivider =
      mainView.querySelector(
        '.main-menu__divider'
      );

    if (!originalDivider) {
      return getClosedDividerY();
    }

    const mainRect =
      mainView.getBoundingClientRect();

    const dividerRect =
      originalDivider.getBoundingClientRect();

    return (
      dividerRect.top -
      mainRect.top
    );
  };

  /* =========================================================
     DIVIDER POSITION
     ========================================================= */

  const syncDividerPosition = () => {
    if (
      !mainView ||
      !homeView ||
      !divider
    ) {
      return;
    }

    const targetY =
      isMenuOpen()
        ? getOpenDividerY()
        : getClosedDividerY();

    homeView.style.setProperty(
      '--home-divider-y',
      `${targetY}px`
    );
  };

  /* =========================================================
     DIVIDER SYNC SCHEDULER
     ========================================================= */

  const scheduleDividerSync = () => {
    if (syncFrame !== null) {
      window.cancelAnimationFrame(
        syncFrame
      );
    }

    syncFrame =
      window.requestAnimationFrame(
        () => {
          syncFrame = null;

          syncDividerPosition();
        }
      );
  };

  /* =========================================================
     DIVIDER REVEAL
     ========================================================= */

  const revealDivider = () => {
    if (
      !homeView ||
      dividerVisible
    ) {
      return;
    }

    syncDividerPosition();

    dividerVisible = true;

    window.requestAnimationFrame(
      () => {
        window.requestAnimationFrame(
          () => {
            if (!homeView) {
              return;
            }

            homeView.classList.add(
              'is-divider-visible'
            );
          }
        );
      }
    );
  };

  /* =========================================================
     WAIT FOR CONTROLS ARRIVAL
     Divider se objeví až po dojezdu hamburgeru a lupy.
     ========================================================= */

  const waitForControlsArrival = () => {
    if (
      !mainView ||
      dividerVisible
    ) {
      return;
    }

    const control =
      mainView.querySelector(
        '.main-view__header-button'
      );

    if (!control) {
      revealDivider();
      return;
    }

    const handleTransitionEnd = (
      event
    ) => {
      if (
        event.target !== control ||
        event.propertyName !== 'transform'
      ) {
        return;
      }

      control.removeEventListener(
        'transitionend',
        handleTransitionEnd
      );

      revealDivider();
    };

    control.addEventListener(
      'transitionend',
      handleTransitionEnd
    );
  };

  /* =========================================================
     WATCH CONTROLS
     ========================================================= */

  const watchControls = () => {
    if (!mainView) {
      return;
    }

    if (
      mainView.classList.contains(
        'is-controls-visible'
      )
    ) {
      waitForControlsArrival();
      return;
    }

    controlsObserver =
      new MutationObserver(
        () => {
          if (
            !mainView ||
            !mainView.classList.contains(
              'is-controls-visible'
            )
          ) {
            return;
          }

          if (controlsObserver) {
            controlsObserver.disconnect();
            controlsObserver = null;
          }

          waitForControlsArrival();
        }
      );

    controlsObserver.observe(
      mainView,
      {
        attributes: true,
        attributeFilter: [
          'class'
        ]
      }
    );
  };

  /* =========================================================
     WATCH MENU STATE
     CLOSED = divider nahoře.
     OPEN = stejný divider pod menu.
     ========================================================= */

  const watchMenuState = () => {
    if (!mainView) {
      return;
    }

    menuStateObserver =
      new MutationObserver(
        () => {
          scheduleDividerSync();
        }
      );

    menuStateObserver.observe(
      mainView,
      {
        attributes: true,
        attributeFilter: [
          'class'
        ]
      }
    );
  };

  /* =========================================================
     WATCH MENU LAYOUT
     Panely ABOUT / MY ART / VISION / CONTACT
     mohou měnit výšku menu.
     ========================================================= */

  const watchMenuLayout = () => {
    if (
      !mainView ||
      typeof ResizeObserver ===
        'undefined'
    ) {
      return;
    }

    const menuContent =
      mainView.querySelector(
        '.main-menu__content'
      );

    const menuList =
      mainView.querySelector(
        '.main-menu__list'
      );

    const logo =
      mainView.querySelector(
        '.main-view__logo'
      );

    layoutObserver =
      new ResizeObserver(
        () => {
          scheduleDividerSync();
        }
      );

    if (menuContent) {
      layoutObserver.observe(
        menuContent
      );
    }

    if (menuList) {
      layoutObserver.observe(
        menuList
      );
    }

    if (logo) {
      layoutObserver.observe(
        logo
      );
    }

    const panels =
      mainView.querySelectorAll(
        '.main-menu__panel'
      );

    panels.forEach(
      (panel) => {
        layoutObserver.observe(
          panel
        );
      }
    );
  };

  /* =========================================================
     CREATE HOME
     ========================================================= */

  const createHome = () => {
    if (
      homeCreated ||
      !mainView
    ) {
      return;
    }

    homeCreated = true;

    homeView = createElement(
      'section',
      'home-view'
    );

    homeView.id =
      'homeView';

    homeView.setAttribute(
      'aria-label',
      'Václav Buchtelík home'
    );

    divider = createElement(
      'div',
      'home-view__divider'
    );

    divider.setAttribute(
      'aria-hidden',
      'true'
    );

    homeView.appendChild(
      divider
    );

    mainView.appendChild(
      homeView
    );

    /* ---------------------------------------------------------
       INITIAL POSITION
       --------------------------------------------------------- */

    syncDividerPosition();

    /* ---------------------------------------------------------
       WATCHERS
       --------------------------------------------------------- */

    watchControls();
    watchMenuState();
    watchMenuLayout();
  };

  /* =========================================================
     FIND MAIN
     ========================================================= */

  const findMain = () => {
    const existingMain =
      document.getElementById(
        'mainView'
      );

    if (!existingMain) {
      return false;
    }

    mainView = existingMain;

    createHome();

    return true;
  };

  /* =========================================================
     RESIZE
     ========================================================= */

  const handleResize = () => {
    if (!mainView) {
      return;
    }

    scheduleDividerSync();
  };

  window.addEventListener(
    'resize',
    handleResize,
    {
      passive: true
    }
  );

  window.addEventListener(
    'orientationchange',
    handleResize,
    {
      passive: true
    }
  );

  /* =========================================================
     START
     ========================================================= */

  if (!findMain()) {
    mainObserver =
      new MutationObserver(
        () => {
          if (!findMain()) {
            return;
          }

          if (mainObserver) {
            mainObserver.disconnect();
            mainObserver = null;
          }
        }
      );

    mainObserver.observe(
      document.body,
      {
        childList: true
      }
    );
  }

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
      }

      if (controlsObserver) {
        controlsObserver.disconnect();
        controlsObserver = null;
      }

      if (menuStateObserver) {
        menuStateObserver.disconnect();
        menuStateObserver = null;
      }

      if (layoutObserver) {
        layoutObserver.disconnect();
        layoutObserver = null;
      }

      if (syncFrame !== null) {
        window.cancelAnimationFrame(
          syncFrame
        );

        syncFrame = null;
      }
    },
    {
      once: true
    }
  );
})();
