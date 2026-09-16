'use strict';

/* =========================================================
   VÁCLAV BUCHTELÍK — GALLERY SWIPE HAND INTRO
   SMOKED OVERLAY + TWO HUMAN SWIPE GESTURES
   ========================================================= */

(() => {
  const START_DELAY_MS = 260;
  const OVERLAY_FADE_IN_MS = 420;

  const HAND_ENTER_MS = 1100;
  const HAND_SETTLE_MS = 380;

  const HAND_SWIPE_MS = 900;
  const BETWEEN_SWIPES_MS = 520;

  const AFTER_SWIPES_HOLD_MS = 320;

  const HAND_EXIT_MS = 1000;
  const OVERLAY_FADE_OUT_MS = 420;

  const HAND_SRC = '/assets/swipe-ui.png';

  let overlay = null;
  let stage = null;
  let hand = null;

  let active = false;
  let runId = 0;

  const timers = new Set();

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

  const nextFrame = () =>
    new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
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
     RESET
     ========================================================= */

  const resetHand = () => {
    if (!hand) return;

    hand.classList.remove(
      'is-entering',
      'is-settled',
      'is-swiping',
      'is-exiting'
    );

    void hand.offsetWidth;
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
     ========================================================= */

  const enterHand = async id => {
    if (!isCurrentRun(id) || !hand) return;

    resetHand();

    hand.classList.add('is-entering');

    await wait(HAND_ENTER_MS, id);

    if (!isCurrentRun(id)) return;

    hand.classList.remove('is-entering');
    hand.classList.add('is-settled');

    await nextFrame();
  };

  /* =========================================================
     SINGLE SWIPE
     ========================================================= */

  const swipeHand = async id => {
    if (!isCurrentRun(id) || !hand) return;

    hand.classList.remove('is-swiping');

    void hand.offsetWidth;

    hand.classList.add('is-swiping');

    await wait(HAND_SWIPE_MS, id);

    if (!isCurrentRun(id)) return;

    hand.classList.remove('is-swiping');
    hand.classList.add('is-settled');

    await nextFrame();
  };

  /* =========================================================
     HAND EXIT
     ========================================================= */

  const exitHand = async id => {
    if (!isCurrentRun(id) || !hand) return;

    hand.classList.remove(
      'is-entering',
      'is-swiping',
      'is-settled'
    );

    void hand.offsetWidth;

    hand.classList.add('is-exiting');

    await wait(HAND_EXIT_MS, id);
  };

  /* =========================================================
     FINISH
     ========================================================= */

  const finishIntro = async id => {
    if (!isCurrentRun(id) || !overlay) return;

    /*
     * The hand has already travelled outside the viewport.
     * Now remove the smoked glass.
     */
    overlay.classList.add('is-exiting');

    await wait(OVERLAY_FADE_OUT_MS, id);

    if (!isCurrentRun(id)) return;

    active = false;

    overlay.classList.remove('is-open', 'is-exiting');
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');

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
     * First artwork is already visible when
     * vb:gallery-opened is dispatched.
     */
    await wait(START_DELAY_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Smoke the already-visible artwork.
     */
    overlay.classList.remove('is-hidden', 'is-exiting');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    await wait(OVERLAY_FADE_IN_MS, id);

    if (!isCurrentRun(id)) return;

    /*
     * Hand enters from the right and settles
     * around the centre of the artwork.
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
     * Hand returns to the right side and disappears.
     */
    await exitHand(id);

    if (!isCurrentRun(id)) return;

    /*
     * Only after the hand is gone does the smoked
     * overlay disappear and interaction return.
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
    resetOverlay();

    /*
     * Overlay exists immediately and owns pointer input.
     * Its visual darkening starts shortly afterwards.
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
