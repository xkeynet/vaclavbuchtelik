'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY SWIPE HAND INTRO
   SMOKED OVERLAY + CINEMATIC HUMAN SWIPE GESTURE
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
   * More natural resting angle.
   * The hand itself points slightly to the left instead
   * of standing vertically like a straight pointer.
   */
  const HAND_ROTATION = -28;

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
     SLOW CINEMATIC DECELERATION
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
            `translate3d(calc(50vw + 90px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.08
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 72px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.62
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 22px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.84
        },
        {
          opacity: 1,
          transform: settledTransform(),
          offset: 1
        }
      ],
      {
        duration: HAND_ENTER_MS,
        easing: 'cubic-bezier(0.12, 0.82, 0.18, 1)',
        fill: 'forwards'
      },
      id
    );

    if (!isCurrentRun(id)) return;

    setHandSettled();
  };

  /* =========================================================
     HUMAN SWIPE
     WIPER ARC:
     REST -> UP + RIGHT ARC -> SOFT RETURN ON SAME ARC
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
         * RESTING POSITION
         */
        {
          opacity: 1,
          transform:
            `translate3d(-50%, -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0
        },

        /*
         * Tiny preparation.
         * Almost stationary before the flick begins.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% - 3px), calc(-50% + 7px), 0) rotate(${HAND_ROTATION - 1}deg)`,
          offset: 0.14
        },

        /*
         * Beginning of the circular trajectory.
         * The hand starts travelling UP and RIGHT.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 15px), calc(-50% - 24px), 0) rotate(${HAND_ROTATION + 3}deg)`,
          offset: 0.24
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 42px), calc(-50% - 58px), 0) rotate(${HAND_ROTATION + 7}deg)`,
          offset: 0.32
        },

        /*
         * Main flick.
         * Horizontal displacement grows as the hand rises,
         * producing the visible wiper / circular arc.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 78px), calc(-50% - 88px), 0) rotate(${HAND_ROTATION + 12}deg)`,
          offset: 0.39
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 116px), calc(-50% - 110px), 0) rotate(${HAND_ROTATION + 17}deg)`,
          offset: 0.45
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 148px), calc(-50% - 120px), 0) rotate(${HAND_ROTATION + 21}deg)`,
          offset: 0.50
        },

        /*
         * TOP-RIGHT END OF ARC
         * Short natural deceleration.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 165px), calc(-50% - 122px), 0) rotate(${HAND_ROTATION + 23}deg)`,
          offset: 0.54
        },

        /*
         * RETURN.
         * Same curved trajectory backwards, deliberately
         * slower than the upward flick.
         */
        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 151px), calc(-50% - 120px), 0) rotate(${HAND_ROTATION + 21}deg)`,
          offset: 0.60
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 125px), calc(-50% - 113px), 0) rotate(${HAND_ROTATION + 18}deg)`,
          offset: 0.67
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 94px), calc(-50% - 97px), 0) rotate(${HAND_ROTATION + 14}deg)`,
          offset: 0.74
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 64px), calc(-50% - 75px), 0) rotate(${HAND_ROTATION + 10}deg)`,
          offset: 0.81
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 38px), calc(-50% - 49px), 0) rotate(${HAND_ROTATION + 6}deg)`,
          offset: 0.87
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 17px), calc(-50% - 24px), 0) rotate(${HAND_ROTATION + 3}deg)`,
          offset: 0.92
        },

        {
          opacity: 1,
          transform:
            `translate3d(calc(-50% + 5px), calc(-50% - 8px), 0) rotate(${HAND_ROTATION + 1}deg)`,
          offset: 0.96
        },

        /*
         * BACK TO EXACTLY THE SAME RESTING POSITION.
         */
        {
          opacity: 1,
          transform: settledTransform(),
          offset: 1
        }
      ],
      {
        duration: HAND_SWIPE_MS,
        easing: 'cubic-bezier(0.42, 0, 0.18, 1)',
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
            `translate3d(calc(-50% + 14px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.16
        },
        {
          opacity: 1,
          transform:
            `translate3d(calc(50vw + 100px), -50%, 0) rotate(${HAND_ROTATION}deg)`,
          offset: 0.86
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
     * First artwork remains completely unobstructed for
     * three seconds after Gallery has opened.
     */
    await wait(START_DELAY_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Only now does the smoked glass begin to appear.
     */
    overlay.classList.remove('is-hidden', 'is-exiting');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    await wait(OVERLAY_FADE_IN_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Hand travels slowly from outside the right edge
     * and naturally decelerates into the centre.
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
     * Hand leaves to the right.
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
     * Keep the overlay visually absent during the initial
     * three-second artwork presentation.
     *
     * Pointer input is nevertheless captured immediately,
     * so the introductory sequence cannot be interrupted.
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
