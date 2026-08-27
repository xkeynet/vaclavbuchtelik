'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — HOME
   ========================================================= */

(() => {
  /* =========================================================
     STATE
     ========================================================= */

  let homeCreated = false;
  let dividerVisible = false;

  let mainView = null;
  let homeView = null;

  let mainObserver = null;
  let controlsObserver = null;

  let dividerFallbackTimer = null;

  /* =========================================================
     TIMING
     ========================================================= */

  const DIVIDER_FALLBACK_MS = 2800;

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
     DIVIDER
     ========================================================= */

  const revealDivider = () => {
    if (
      !homeView ||
      dividerVisible
    ) {
      return;
    }

    dividerVisible = true;

    if (dividerFallbackTimer !== null) {
      window.clearTimeout(
        dividerFallbackTimer
      );

      dividerFallbackTimer = null;
    }

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
     CONTROLS ARRIVAL COMPLETE
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

    dividerFallbackTimer =
      window.setTimeout(
        () => {
          control.removeEventListener(
            'transitionend',
            handleTransitionEnd
          );

          revealDivider();
        },
        DIVIDER_FALLBACK_MS
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

          controlsObserver.disconnect();
          controlsObserver = null;

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

    const divider =
      createElement(
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

    watchControls();
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
     START
     ========================================================= */

  if (!findMain()) {
    mainObserver =
      new MutationObserver(
        () => {
          if (!findMain()) {
            return;
          }

          mainObserver.disconnect();
          mainObserver = null;
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

      if (
        dividerFallbackTimer !== null
      ) {
        window.clearTimeout(
          dividerFallbackTimer
        );

        dividerFallbackTimer = null;
      }
    },
    {
      once: true
    }
  );
})();
