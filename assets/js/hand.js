'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY SWIPE HAND INTRO
   SMOKED OVERLAY + CINEMATIC HUMAN WRIST SWIPE
   ========================================================= */

(() => {
  const START_DELAY_MS = 3000;
  const OVERLAY_FADE_IN_MS = 420;

  const HAND_ENTER_MS = 1900;
  const HAND_SETTLE_MS = 650;

  const HAND_SWIPE_MS = 1850;
  const BETWEEN_SWIPES_MS = 720;

  const AFTER_SWIPES_HOLD_MS = 520;

  const HAND_EXIT_MS = 1500;
  const OVERLAY_FADE_OUT_MS = 420;

  const HAND_SRC = '/assets/swipe-ui.png';

  /*
   * Natural resting angle.
   * The hand is deliberately tilted left.
   */
  const HAND_ROTATION = -30;

  /*
   * Pivot near the wrist.
   * The gesture therefore behaves like a wiper:
   * the hand swings around its lower wrist area instead
   * of travelling mechanically along a straight path.
   */
  const HAND_ORIGIN_X = 70;
  const HAND_ORIGIN_Y = 90;

  let overlay = null;
  let stage = null;
  let hand = null;

  let active = false;
  let runId = 0;

  const timers = new Set();
  const animations = new Set();

  /* =========================================================
     HELPERS
     ========================================================= */

  const isCurrentRun = id => active && id === runId;

  const wait = (delay, id) =>
    new Promise(resolve => {
      if (!isCurrentRun(id)) {
        resolve();
        return;
      }

      const timer = window.setTimeout(() => {
        timers.delete(timer);
        resolve();
      }, delay);

      timers.add(timer);
    });

  const clearTimers = () => {
    timers.forEach(timer => window.clearTimeout(timer));
    timers.clear();
  };

  const cancelAnimations = () => {
    animations.forEach(animation => {
      try {
        animation.cancel();
      } catch (error) {}
    });

    animations.clear();
  };

  const nextFrame = () =>
    new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

  const runAnimation = (element, keyframes, options, id) =>
    new Promise(resolve => {
      if (!element || !isCurrentRun(id)) {
        resolve();
        return;
      }

      const animation = element.animate(keyframes, options);
      animations.add(animation);

      let finished = false;

      const finish = () => {
        if (finished) return;

        finished = true;
        animations.delete(animation);
        resolve();
      };

      animation.addEventListener('finish', finish, { once: true });
      animation.addEventListener('cancel', finish, { once: true });
    });

  /* =========================================================
     GALLERY
     ========================================================= */

  const getGallery = () => document.getElementById('galleryViewer');

  /* =========================================================
     DOM
     ========================================================= */

  const createOverlay = () => {
    const gallery = getGallery();
    if (!gallery) return false;

    if (overlay) {
      if (overlay.parentElement !== gallery) {
        gallery.appendChild(overlay);
      }

      return true;
    }

    overlay = document.createElement('div');
    overlay.className = 'gallery-hand';
    overlay.setAttribute('aria-hidden', 'true');

    stage = document.createElement('div');
    stage.className = 'gallery-hand__stage';

    hand = document.createElement('img');
    hand.className = 'gallery-hand__hand';
    hand.src = HAND_SRC;
    hand.alt = '';
    hand.decoding = 'async';
    hand.draggable = false;
    hand.setAttribute('aria-hidden', 'true');

    hand.style.transformOrigin = `${HAND_ORIGIN_X}% ${HAND_ORIGIN_Y}%`;

    stage.appendChild(hand);
    overlay.appendChild(stage);
    gallery.appendChild(overlay);

    return true;
  };

  /* =========================================================
     HAND GEOMETRY
     ========================================================= */

  const settledTransform = () =>
    `translate3d(-50%, -50%, 0) rotate(${HAND_ROTATION}deg)`;

  const enterTransform = () =>
    `translate3d(calc(50vw + 180px), -50%, 0) rotate(${HAND_ROTATION}deg)`;

  const setHandSettled = () => {
    if (!hand) return;

    hand.style.transformOrigin = `${HAND_ORIGIN_X}% ${HAND_ORIGIN_Y}%`;
    hand.style.opacity = '1';
    hand.style.transform = settledTransform();
    hand.style.willChange = 'transform, opacity';
  };

  /* =========================================================
     RESET
     ========================================================= */

  const resetHand = () => {
    if (!hand) return;

    cancelAnimations();

    hand.classList.remove(
      'is-entering',
      'is-settled',
      'is-swiping',
      'is-exiting'
    );

    hand.style.transformOrigin = `${HAND_ORIGIN_X}% ${HAND_ORIGIN_Y}%`;
    hand.style.opacity = '0';
    hand.style.transform = enterTransform();
    hand.style.willChange = 'transform, opacity';
  };

  const resetOverlay = () => {
    if (!overlay) return;

    overlay.classList.remove(
      'is-open',
      'is-exiting',
      'is-hidden'
    );

    overlay.setAttribute('aria-hidden', 'true');

    resetHand();
  };

  /* =========================================================
     HAND ENTER
     RIGHT -> CENTER
     LONG CINEMATIC DECELERATION
     ========================================================= */

  const enterHand = async id => {
    if (!isCurrentRun(id) || !hand) return;

    resetHand();

    await nextFrame();

    if (!isCurrentRun(id)) return;

    await runAnimation(
      hand,
      [
        {
          opacity: 0,
          transform: enterTransform(),
          offset: 0
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(50vw + 110px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.08
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 105px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.54
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 45px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.72
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 14px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.88
        },
        {
          opacity: 1,
          transform: settledTransform(),
          offset: 1
        }
      ],
      {
        duration: HAND_ENTER_MS,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        fill: 'forwards'
      },
      id
    );

    if (!isCurrentRun(id)) return;

    setHandSettled();
  };

  /* =========================================================
     HUMAN SWIPE
     WRIST PIVOT / WIPER ARC

     IMPORTANT:
     The centre position stays essentially fixed.
     The visible arc is generated mainly by rotation around
     the wrist pivot — not by dragging the whole image
     diagonally across the screen.

     Motion:
     REST -> tiny preload -> quick arc -> slow return
     ========================================================= */

  const swipeHand = async id => {
    if (!isCurrentRun(id) || !hand) return;

    setHandSettled();

    await nextFrame();

    if (!isCurrentRun(id)) return;

    await runAnimation(
      hand,
      [
        /*
         * REST
         */
        {
          opacity: 1,
          transform:
            `translate3d(-50%, -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0
        },

        /*
         * Almost imperceptible preload.
         * Human hand prepares before the flick.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% - 1px), calc(-50% + 2px), 0) rotate(${HAND_ROTATION - 1}deg)`,
          offset: 0.10
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% - 2px), calc(-50% + 3px), 0) rotate(${HAND_ROTATION - 2}deg)`,
          offset: 0.16
        },

        /*
         * FLICK BEGINS.
         * Wrist stays almost stationary.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% - 1px), calc(-50% + 1px), 0) rotate(${HAND_ROTATION + 3}deg)`,
          offset: 0.21
        },

        /*
         * FAST ARC.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 1px), calc(-50% - 2px), 0) rotate(${HAND_ROTATION + 10}deg)`,
          offset: 0.26
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 3px), calc(-50% - 4px), 0) rotate(${HAND_ROTATION + 18}deg)`,
          offset: 0.31
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 5px), calc(-50% - 6px), 0) rotate(${HAND_ROTATION + 25}deg)`,
          offset: 0.35
        },

        /*
         * END OF FLICK.
         * The hand has swept through an arc around the wrist.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 6px), calc(-50% - 7px), 0) rotate(${HAND_ROTATION + 31}deg)`,
          offset: 0.39
        },

        /*
         * Tiny natural overshoot.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 6px), calc(-50% - 7px), 0) rotate(${HAND_ROTATION + 33}deg)`,
          offset: 0.42
        },

        /*
         * TOP SETTLE.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 6px), calc(-50% - 7px), 0) rotate(${HAND_ROTATION + 31}deg)`,
          offset: 0.46
        },

        /*
         * SLOW HUMAN RETURN.
         * Same arc backwards, substantially slower.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 6px), calc(-50% - 7px), 0) rotate(${HAND_ROTATION + 29}deg)`,
          offset: 0.52
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 5px), calc(-50% - 6px), 0) rotate(${HAND_ROTATION + 25}deg)`,
          offset: 0.59
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 4px), calc(-50% - 5px), 0) rotate(${HAND_ROTATION + 21}deg)`,
          offset: 0.66
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 3px), calc(-50% - 4px), 0) rotate(${HAND_ROTATION + 17}deg)`,
          offset: 0.73
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 2px), calc(-50% - 3px), 0) rotate(${HAND_ROTATION + 13}deg)`,
          offset: 0.79
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 1px), calc(-50% - 2px), 0) rotate(${HAND_ROTATION + 9}deg)`,
          offset: 0.85
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 1px), calc(-50% - 1px), 0) rotate(${HAND_ROTATION + 6}deg)`,
          offset: 0.90
        },

        {
          opacity: 1,
          transform:
            `translate3d(-50%, -50%, 0) rotate(${HAND_ROTATION + 3}deg)`,
          offset: 0.95
        },

        /*
         * SOFT LANDING BACK AT REST.
         */
        {
          opacity: 1,
          transform: settledTransform(),
          offset: 1
        }
      ],
      {
        duration: HAND_SWIPE_MS,
        easing: 'linear',
        fill: 'forwards'
      },
      id
    );

    if (!isCurrentRun(id)) return;

    setHandSettled();
  };

  /* =========================================================
     HAND EXIT
     CENTER -> RIGHT
     ========================================================= */

  const exitHand = async id => {
    if (!isCurrentRun(id) || !hand) return;

    setHandSettled();

    await nextFrame();

    if (!isCurrentRun(id)) return;

    await runAnimation(
      hand,
      [
        {
          opacity: 1,
          transform: settledTransform(),
          offset: 0
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 10px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.14
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 45px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.28
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(50vw + 100px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.88
        },
        {
          opacity: 0,
          transform: enterTransform(),
          offset: 1
        }
      ],
      {
        duration: HAND_EXIT_MS,
        easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
        fill: 'forwards'
      },
      id
    );
  };

  /* =========================================================
     FINISH
     ========================================================= */

  const finishIntro = async id => {
    if (!isCurrentRun(id) || !overlay) return;

    overlay.classList.add('is-exiting');

    await wait(OVERLAY_FADE_OUT_MS, id);

    if (!isCurrentRun(id)) return;

    active = false;

    overlay.classList.remove('is-open', 'is-exiting');
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.pointerEvents = '';

    resetHand();

    window.dispatchEvent(
      new CustomEvent('vb:gallery-hand-finished')
    );
  };

  /* =========================================================
     SEQUENCE
     ========================================================= */

  const runSequence = async id => {
    /*
     * First artwork remains completely unobstructed
     * for three seconds.
     */
    await wait(START_DELAY_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Smoked glass appears only after the initial
     * artwork presentation.
     */
    overlay.classList.remove('is-hidden', 'is-exiting');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    await wait(OVERLAY_FADE_IN_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Hand enters from the right and decelerates
     * smoothly into its resting position.
     */
    await enterHand(id);

    if (!isCurrentRun(id)) return;

    await wait(HAND_SETTLE_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * SWIPE #1
     */
    await swipeHand(id);

    if (!isCurrentRun(id)) return;

    await wait(BETWEEN_SWIPES_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * SWIPE #2
     */
    await swipeHand(id);

    if (!isCurrentRun(id)) return;

    await wait(AFTER_SWIPES_HOLD_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Hand returns to the right.
     */
    await exitHand(id);

    if (!isCurrentRun(id)) return;

    /*
     * Smoked glass disappears only after the hand
     * has completely left the viewport.
     */
    await finishIntro(id);
  };

  /* =========================================================
     OPEN
     ========================================================= */

  const openIntro = () => {
    if (active) return;
    if (!createOverlay()) return;

    active = true;
    runId += 1;

    const id = runId;

    clearTimers();
    cancelAnimations();
    resetOverlay();

    /*
     * The first artwork remains visually clean during
     * START_DELAY_MS, but interaction is locked immediately.
     */
    overlay.classList.remove('is-hidden');
    overlay.style.pointerEvents = 'auto';

    runSequence(id);
  };

  /* =========================================================
     CLOSE / CANCEL
     ========================================================= */

  const closeIntro = () => {
    runId += 1;
    active = false;

    clearTimers();
    cancelAnimations();

    if (!overlay) return;

    resetOverlay();

    overlay.classList.add('is-hidden');
    overlay.style.pointerEvents = '';
  };

  /* =========================================================
     GALLERY EVENTS
     ========================================================= */

  window.addEventListener('vb:gallery-opened', () => {
    openIntro();
  });

  window.addEventListener('vb:gallery-closed', () => {
    closeIntro();
  });

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.VBGalleryHand = Object.freeze({
    open: openIntro,
    close: closeIntro,
    isActive: () => active
  });

  /* =========================================================
     CLEANUP
     ========================================================= */

  window.addEventListener(
    'pagehide',
    () => {
      runId += 1;
      active = false;

      clearTimers();
      cancelAnimations();

      if (overlay) {
        overlay.remove();
      }

      overlay = null;
      stage = null;
      hand = null;
    },
    { once: true }
  );
})();
